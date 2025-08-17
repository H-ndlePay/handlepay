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

// CCTP TokenMessenger ABI (standard depositForBurn)
const TOKEN_MESSENGER_ABI = [
  'function depositForBurn(uint256 amount,uint32 destinationDomain,bytes32 mintRecipient,address burnToken) external returns (uint64)',
];

// Message Transmitter ABI
const MESSAGE_TRANSMITTER_ABI = [
  'function receiveMessage(bytes message, bytes attestation) external returns (bool)',
];

// CCTP domains
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

// CCTP contract addresses (same on all supported chains)
const TOKEN_MESSENGER = '0xBd3fa81B58Ba92a82136038B25aDec7066af3155';
const MESSAGE_TRANSMITTER = '0x0a992d191DEeC32aFe36203Ad87D7d289a738F81';

// Utility functions
function req(x, m) {
  if (x === undefined || x === null) throw new Error(m);
  return x;
}

function addressToBytes32(ethers, addr) {
  // bytes32 with address in the LOW 20 bytes (left-padded with zeros)
  return ethers.hexlify(ethers.zeroPadValue(ethers.getAddress(addr), 32));
}

task('pay-usdc-xchain', 'Cross-chain USDC transfer using CCTP')
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
    .addOptionalParam('srcRpc', 'Override source chain RPC')
    .addOptionalParam('dstRpc', 'Override destination chain RPC')
    .addOptionalParam('tx', 'Resume with existing burn tx hash')
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

      const messenger =
          new ethers.Contract(TOKEN_MESSENGER, TOKEN_MESSENGER_ABI, srcSigner);
      const transmitter = new ethers.Contract(
          MESSAGE_TRANSMITTER, MESSAGE_TRANSMITTER_ABI, dstSigner);

      // Step 3: Either resume existing burn or create new one
      let burnTxHash = args.tx;

      if (!burnTxHash) {
        console.log(`\n🔥 Initiating burn on ${srcKey}...`);

        // Check and approve USDC
        const owner = await srcSigner.getAddress();
        const allowance = await usdc.allowance(owner, TOKEN_MESSENGER);
        if (allowance < amount) {
          console.log(`   Approving USDC...`);
          const approveTx = await usdc.approve(TOKEN_MESSENGER, amount);
          console.log(`   Approval tx: ${approveTx.hash}`);
          await approveTx.wait();
        }

        // Prepare mint recipient
        const mintRecipient32 = addressToBytes32(ethers, recipient);

        // Execute burn transaction
        console.log(`   Executing depositForBurn...`);
        const burnTx = await messenger.depositForBurn(
            amount, dstDomain, mintRecipient32, usdcSrc);

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

      const attestationUrl =
          `https://iris-api.circle.com/attestations/${srcDomain}/${burnTxHash}`;
      let message, attestation;
      const startTime = Date.now();
      const pollInterval = 5000;  // 5 seconds
      let lastStatus = '';

      while (true) {
        try {
          const response = await fetch(attestationUrl);
          if (response.ok) {
            const data = await response.json();
            if (data.status === 'complete') {
              message = data.message;
              attestation = data.attestation;
              break;
            } else if (data.status !== lastStatus) {
              const elapsed = Math.floor((Date.now() - startTime) / 1000);
              console.log(`   Status: ${data.status || 'pending'} (${
                  elapsed}s elapsed)`);
              lastStatus = data.status;
            }
          } else if (response.status === 404) {
            // Transaction not found yet
            if (lastStatus !== 'waiting') {
              const elapsed = Math.floor((Date.now() - startTime) / 1000);
              console.log(
                  `   Status: waiting for indexing (${elapsed}s elapsed)`);
              lastStatus = 'waiting';
            }
          }
        } catch (error) {
          console.log(`   Network error: ${error.message}, retrying...`);
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }

      const attestationTime = Math.floor((Date.now() - startTime) / 1000);
      console.log(`   ✅ Attestation received (${attestationTime}s)`);

      // Step 5: Finalize on destination chain
      console.log(`\n💎 Finalizing on ${dstKey}...`);

      try {
        console.log(`   Calling receiveMessage...`);
        const mintTx = await transmitter.receiveMessage(message, attestation);
        console.log(`   Mint tx: ${mintTx.hash}`);
        await mintTx.wait();

        console.log(`\n✅ Success! ${args.amount} USDC transferred to ${
            recipient} on ${dstKey}`);

        // Check final balance
        try {
          const dstUsdc = ethers.getAddress(USDC[dstKey]);
          const dstUsdcContract =
              new ethers.Contract(dstUsdc, IERC20_ABI, dstProvider);
          const finalBalance = await dstUsdcContract.balanceOf(recipient);
          console.log(`   Recipient balance: ${
              ethers.formatUnits(finalBalance, decimals)} USDC`);
        } catch (e) {
          // Balance check is optional
        }

      } catch (error) {
        if (error.message &&
            (error.message.includes('already executed') ||
             error.message.includes('Already executed') ||
             error.message.includes('message has already been received') ||
             error.message.includes('Nonce already used'))) {
          console.log(`\n✅ Message already processed. Transfer complete.`);

          // Try to check balance anyway
          try {
            const dstUsdc = ethers.getAddress(USDC[dstKey]);
            const dstUsdcContract =
                new ethers.Contract(dstUsdc, IERC20_ABI, dstProvider);
            const finalBalance = await dstUsdcContract.balanceOf(recipient);
            console.log(`   Recipient balance: ${
                ethers.formatUnits(finalBalance, decimals)} USDC`);
          } catch (e) {
            // Balance check is optional
          }
        } else {
          console.log(`\n❌ Failed to finalize transfer`);
          console.log(`   Error: ${error.message || error}`);
          throw error;
        }
      }
    });