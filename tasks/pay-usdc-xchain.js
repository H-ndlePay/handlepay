// tasks/pay-usdc-xchain.js
const {task} = require('hardhat/config');

if (typeof fetch !== 'function')
  throw new Error('Node 18+ required (global fetch)');

const IERC20_ABI = [
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner,address spender) view returns (uint256)',
  'function approve(address spender,uint256 value) returns (bool)',
];

const REG_ABI = [
  'function getMemberByHandle(string platform,string username) view returns (tuple(uint256 id,address wallet,uint256 joinedBlock,bool isActive))',
];

// CCTP v2 TokenMessenger + hooks + finality (same on EVMs)
const TOKEN_MESSENGER_V2_ABI = [
  'function depositForBurn(uint256 amount,uint32 destinationDomain,bytes32 mintRecipient,address burnToken,bytes32 destinationCaller,uint256 maxFee,uint32 minFinalityThreshold) external',
  'function depositForBurnWithHook(uint256 amount,uint32 destinationDomain,bytes32 mintRecipient,address burnToken,bytes32 destinationCaller,uint256 maxFee,uint32 minFinalityThreshold,bytes hookData) external',
];

// Your hook receiver interface (destination side)
const RECEIVER_ABI = [
  'function mintAndLog(bytes message, bytes attestation) external',
];

// v2 transmitter (same on EVMs)
const MESSAGE_TRANSMITTER_V2_ABI = [
  'function receiveMessage(bytes message, bytes attestation) external returns (bool)',
];

// CCTP v2 domains
const DOMAINS = {
  ethereum: 0,
  avalanche: 1,
  op: 2,
  arbitrum: 3,
  base: 6,
  polygon: 7,
  linea: 11,
};

// Default RPCs
const RPCS = {
  ethereum: 'https://eth.llamarpc.com',
  base: 'https://mainnet.base.org',
  arbitrum: 'https://arb1.arbitrum.io/rpc',
  op: 'https://mainnet.optimism.io',
  polygon: 'https://polygon-bor.publicnode.com',
  avalanche: 'https://api.avax.network/ext/bc/C/rpc',
  linea: 'https://rpc.linea.build',
};

// Canonical USDC addresses
const USDC = {
  ethereum: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  base: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
  arbitrum: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
  op: '0x0b2c639c533813f4aa9d7837caf62653d097ff85',
  polygon: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
  avalanche: '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e',
  linea: '0x176211869ca2b568f2a7d4ee941e073a821ee1ff',
};

// CCTP v2 contract addresses (same on supported EVMs)
const TOKEN_MESSENGER_V2 = '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d';
const MESSAGE_TRANSMITTER_V2 = '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64';

// YOUR deployed hook receiver contracts (per destination chain)
// Add your hook receiver addresses here as you deploy them
const DST_HOOK = {
  ethereum: '0x26447a80c4F6b74AC77Fb14Da30b45a9D8fc0662',
  base: '0x1f184E5CC0EDE2eFd67a3cE51dB1347A2C3dC1c8',
  // Add more chains as needed:
  // arbitrum: '0x...',
  // op: '0x...',
};

// Utility functions
function req(x, m) {
  if (x === undefined || x === null) throw new Error(m);
  return x;
}

function leftPadAddrToBytes32(ethers, addr) {
  // bytes32 with address in the LOW 20 bytes (left-padded with zeros)
  return ethers.hexlify(ethers.zeroPadValue(ethers.getAddress(addr), 32));
}

function bytes32Low20ToAddr(ethers, b32) {
  return ethers.getAddress('0x' + b32.slice(-40));
}

function isZeroBytes32(hex) {
  return /^0x0{64}$/i.test(hex);
}

task('pay-usdc-xchain', 'Cross-chain USDC transfer using CCTP v2 with hooks')
    .addParam(
        'src',
        'Source chain (ethereum|base|arbitrum|op|polygon|avalanche|linea)')
    .addParam('dst', 'Destination chain')
    .addParam('amount', 'USDC amount (e.g., 2.0)')
    .addOptionalParam('platform', 'Handle platform (e.g., twitter)')
    .addOptionalParam('username', 'Handle username')
    .addOptionalParam('to', 'Recipient address (skip handle lookup)')
    .addOptionalParam(
        'registry', 'HandleRegistry address on Base',
        '0x132727D74dF3246b64046598626415258dc648f0')
    .addOptionalParam(
        'resolveRpc', 'RPC for handle resolution', 'https://mainnet.base.org')
    .addOptionalParam('pk', 'Private key hex (no 0x prefix)')
    .addOptionalParam(
        'minFinality', 'Finality: 1000=Fast, 2000=Finalized', '1000')
    .addOptionalParam('srcRpc', 'Override source chain RPC')
    .addOptionalParam('dstRpc', 'Override destination chain RPC')
    .addOptionalParam('tx', 'Resume with existing burn tx hash')
    .addOptionalParam(
        'hookData', 'Custom hook data (0x...); auto-generated if omitted')
    .addFlag('noHook', 'Use classic depositForBurn without hooks')
    .setAction(async (args, hre) => {
      const {ethers} = hre;

      // Validate chains
      const srcKey = args.src.toLowerCase();
      const dstKey = args.dst.toLowerCase();
      const srcDomain = DOMAINS[srcKey];
      const dstDomain = DOMAINS[dstKey];

      if (srcDomain === undefined)
        throw new Error(`Unsupported source chain: ${args.src}`);
      if (dstDomain === undefined)
        throw new Error(`Unsupported destination chain: ${args.dst}`);

      // Setup RPCs
      const srcRpc = args.srcRpc || RPCS[srcKey];
      const dstRpc = args.dstRpc || RPCS[dstKey];
      req(srcRpc, `No RPC configured for ${srcKey}`);
      req(dstRpc, `No RPC configured for ${dstKey}`);

      // Get USDC address for source chain
      const usdcSrc = ethers.getAddress(
          req(USDC[srcKey], `USDC not configured for ${srcKey}`));

      // Setup providers
      const srcProvider = new ethers.JsonRpcProvider(srcRpc);
      const dstProvider = new ethers.JsonRpcProvider(dstRpc);

      // Setup signer
      const signer = args.pk ? new ethers.Wallet('0x' + args.pk) :
                               (await ethers.getSigners())[0];

      const srcSigner = signer.connect(srcProvider);
      const dstSigner = signer.connect(dstProvider);

      console.log(`\n🔄 Cross-chain USDC Transfer`);
      console.log(`   From: ${srcKey} → To: ${dstKey}`);
      console.log(`   Sender: ${await srcSigner.getAddress()}`);

      // Step 1: Resolve recipient address
      let recipient = args.to;
      if (!recipient) {
        if (!args.platform || !args.username) {
          throw new Error(
              'Provide --to address OR both --platform and --username');
        }

        console.log(
            `\n📋 Resolving handle: @${args.username} on ${args.platform}`);
        const resolveProvider = new ethers.JsonRpcProvider(args.resolveRpc);
        const registry =
            new ethers.Contract(args.registry, REG_ABI, resolveProvider);

        try {
          const member =
              await registry.getMemberByHandle(args.platform, args.username);
          if (!member.isActive) throw new Error('Handle not active');
          recipient = member.wallet;
        } catch (e) {
          throw new Error(`Failed to resolve handle: ${e.message}`);
        }
      }
      console.log(`   Recipient: ${recipient}`);

      // Step 2: Setup contracts and parse amount
      const usdc = new ethers.Contract(usdcSrc, IERC20_ABI, srcSigner);
      const decimals = await usdc.decimals();
      const amount = ethers.parseUnits(args.amount, decimals);
      console.log(`   Amount: ${args.amount} USDC`);

      const messenger = new ethers.Contract(
          TOKEN_MESSENGER_V2, TOKEN_MESSENGER_V2_ABI, srcSigner);
      const transmitter = new ethers.Contract(
          MESSAGE_TRANSMITTER_V2, MESSAGE_TRANSMITTER_V2_ABI, dstSigner);

      // Step 3: Either resume existing burn or create new one
      const minFinality = parseInt(args.minFinality || '1000', 10);
      let burnTxHash = args.tx;

      if (!burnTxHash) {
        console.log(`\n🔥 Initiating burn on ${srcKey}...`);

        // Fetch fee from Circle API
        const feeUrl = `https://iris-api.circle.com/v2/burn/USDC/fees/${
            srcDomain}/${dstDomain}`;
        const feeRes = await fetch(feeUrl);
        if (!feeRes.ok) throw new Error(`Fee API failed: ${feeRes.status}`);

        const feeData = await feeRes.json();
        const minFeeBps = BigInt(feeData?.data?.minimumFee ?? 0n);
        const maxFee = (amount * minFeeBps) / 10000n;
        console.log(`   Fee: ${minFeeBps} bps → max ${
            ethers.formatUnits(maxFee, decimals)} USDC`);

        // Check and approve USDC
        const owner = await srcSigner.getAddress();
        const allowance = await usdc.allowance(owner, TOKEN_MESSENGER_V2);
        if (allowance < amount) {
          console.log(`   Approving USDC...`);
          const approveTx = await usdc.approve(TOKEN_MESSENGER_V2, amount);
          console.log(`   Approval tx: ${approveTx.hash}`);
          await approveTx.wait();
        }

        // Prepare mint recipient (always the final recipient address)
        const mintRecipient32 = leftPadAddrToBytes32(ethers, recipient);

        // Execute burn transaction
        let burnTx;
        if (args.noHook) {
          // Classic burn without hooks
          console.log(`   Executing depositForBurn (no hooks)...`);
          burnTx = await messenger.depositForBurn(
              amount, dstDomain, mintRecipient32, usdcSrc,
              ethers.ZeroHash,  // No destination caller
              maxFee, minFinality);
        } else {
          // Burn with hooks
          const hookReceiver = DST_HOOK[dstKey];
          if (!hookReceiver) {
            throw new Error(
                `No hook receiver configured for ${dstKey}. ` +
                `Deploy a hook receiver contract first or use --noHook flag.`);
          }

          const destinationCaller32 =
              leftPadAddrToBytes32(ethers, hookReceiver);

          // Build hook data if not provided
          let hookData = args.hookData;
          if (!hookData) {
            if (!args.platform || !args.username) {
              // Create minimal hook data if no handle info
              hookData = new ethers.AbiCoder().encode(
                  ['string', 'uint256'], ['XFER', amount]);
            } else {
              // Create full hook data with handle info
              hookData = new ethers.AbiCoder().encode(
                  ['string', 'string', 'string', 'uint256'],
                  ['HPAY', args.platform, args.username, amount]);
            }
          }

          console.log(`   Hook receiver: ${hookReceiver}`);
          console.log(`   Hook data size: ${(hookData.length - 2) / 2} bytes`);
          console.log(`   Executing depositForBurnWithHook...`);

          burnTx = await messenger.depositForBurnWithHook(
              amount, dstDomain, mintRecipient32, usdcSrc, destinationCaller32,
              maxFee, minFinality, hookData);
        }

        console.log(`   Burn tx: ${burnTx.hash}`);
        await burnTx.wait();
        burnTxHash = burnTx.hash;
        console.log(`   ✅ Burn confirmed`);
      } else {
        console.log(`\n♻️  Resuming with existing burn tx: ${burnTxHash}`);
      }

      // Step 4: Wait for Circle attestation
      console.log(`\n⏳ Waiting for Circle attestation...`);
      console.log(
          `   (This typically takes 10-20 minutes. Press Ctrl+C to abort)`);

      const attestationUrl = `https://iris-api.circle.com/v2/messages/${
          srcDomain}?transactionHash=${burnTxHash}`;
      let message, attestation;
      const startTime = Date.now();
      const pollInterval = 5000;  // 5 seconds
      let lastStatus = '';

      while (true) {
        try {
          const response = await fetch(attestationUrl);
          if (!response.ok) {
            console.log(`   API error (${response.status}), retrying...`);
          } else {
            const data = await response.json();
            const msg = (data.messages || [])[0] || {};
            const att = msg.attestation;
            const msgHex = msg.message;

            // Determine status
            let status;
            if (!att) {
              status = 'WAITING';
            } else if (att === 'PENDING') {
              status = 'PENDING';
            } else if (att && msgHex && msgHex !== '0x') {
              status = 'READY';
            } else {
              status = 'PROCESSING';
            }

            // Update status if changed
            if (status !== lastStatus) {
              const elapsed = Math.floor((Date.now() - startTime) / 1000);
              console.log(`   Status: ${status} (${elapsed}s elapsed)`);
              lastStatus = status;
            }

            // Check if ready
            if (status === 'READY') {
              message = msgHex;
              attestation = '0x' + att.replace(/^0x/, '');
              break;
            }
          }
        } catch (error) {
          console.log(`   Network error: ${error.message}, retrying...`);
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }

      const attestationTime = Math.floor((Date.now() - startTime) / 1000);
      console.log(`   ✅ Attestation received (${attestationTime}s)`);

      // Step 5: Determine if we need to use hooks for minting
      console.log(`\n🔍 Processing message for ${dstKey}...`);

      // Decode message header to check for destination caller
      const coder = new ethers.AbiCoder();
      const header = coder.decode(
          [
            'uint32', 'uint32', 'uint32', 'bytes32', 'bytes32', 'bytes32',
            'bytes32'
          ],
          message.slice(0, 228)  // First 228 bytes contain the header
      );

      // Check if hooks are configured for this destination
      const configuredHook = DST_HOOK[dstKey];
      let useHook = false;
      let hookContract = null;

      if (!args.noHook && configuredHook) {
        // Verify the hook contract exists
        try {
          const hookCode = await dstProvider.getCode(configuredHook);
          if (hookCode && hookCode !== '0x' && hookCode !== '0x0') {
            useHook = true;
            hookContract = configuredHook;
            console.log(`   Using hook receiver: ${hookContract}`);
          } else {
            console.log(`   ⚠️  Hook configured but no contract found at ${
                configuredHook}`);
            console.log(`   Falling back to direct mint`);
          }
        } catch (e) {
          console.log(`   ⚠️  Error checking hook contract: ${e.message}`);
          console.log(`   Falling back to direct mint`);
        }
      }

      // Step 6: Finalize on destination chain
      console.log(`\n💎 Finalizing on ${dstKey}...`);

      try {
        if (useHook && hookContract) {
          // Use hook receiver to mint
          const receiver =
              new ethers.Contract(hookContract, RECEIVER_ABI, dstSigner);
          console.log(`   Calling mintAndLog on hook receiver...`);
          const mintTx = await receiver.mintAndLog(message, attestation);
          console.log(`   Mint tx: ${mintTx.hash}`);
          await mintTx.wait();
        } else {
          // Direct mint via message transmitter
          console.log(`   Calling receiveMessage on transmitter...`);
          const mintTx = await transmitter.receiveMessage(message, attestation);
          console.log(`   Mint tx: ${mintTx.hash}`);
          await mintTx.wait();
        }

        console.log(`\n✅ Success! ${args.amount} USDC transferred to ${
            recipient} on ${dstKey}`);

        // Check final balance if possible
        try {
          const dstUsdc = ethers.getAddress(USDC[dstKey]);
          const dstUsdcContract =
              new ethers.Contract(dstUsdc, IERC20_ABI, dstProvider);
          const finalBalance = await dstUsdcContract.balanceOf(recipient);
          console.log(`   Recipient balance: ${
              ethers.formatUnits(finalBalance, decimals)} USDC`);
        } catch (e) {
          // Balance check is optional, don't fail if it doesn't work
        }

      } catch (error) {
        // Check if the message was already processed
        if (error.message && error.message.includes('already processed')) {
          console.log(`\n✅ Message already processed. Transfer complete.`);
        } else {
          throw error;
        }
      }
    });