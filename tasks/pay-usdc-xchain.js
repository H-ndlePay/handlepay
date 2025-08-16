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
  'function getMemberByHandle(string,string) view returns (tuple(uint256 id,address wallet,uint256 joinedBlock,bool isActive))',
];

const TOKEN_MESSENGER_V2_ABI = [
  'function depositForBurn(uint256,uint32,bytes32,address,bytes32,uint256,uint32) external',
  'function depositForBurnWithHook(uint256,uint32,bytes32,address,bytes32,uint256,uint32,bytes) external',
];

const RECEIVER_ABI = [
  'function mintAndLog(bytes message, bytes attestation) external',
];

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
  linea: 11
};

// default RPCs
const RPCS = {
  ethereum: 'https://eth.llamarpc.com',
  base: 'https://mainnet.base.org',
  arbitrum: 'https://arb1.arbitrum.io/rpc',
  op: 'https://mainnet.optimism.io',
  polygon: 'https://polygon-bor.publicnode.com',
  avalanche: 'https://api.avax.network/ext/bc/C/rpc',
  linea: 'https://rpc.linea.build',
};

// USDC mainnet (lowercase ok; ethers.getAddress will checksum)
const USDC = {
  ethereum: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  base: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
  arbitrum: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
  op: '0x0b2c639c533813f4aa9d7837caf62653d097ff85',
  polygon: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
  avalanche: '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e',
  linea: '0x176211869ca2b568f2a7d4ee941e073a821ee1ff',
};

// CCTP v2 contracts (same across supported EVMs)
const TOKEN_MESSENGER_V2 = '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d';
const MESSAGE_TRANSMITTER_V2 = '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64';

// Hard-coded HookReceiver per destination chain
const DST_HOOK = {
  ethereum: '0x26447a80c4F6b74AC77Fb14Da30b45a9D8fc0662',
  base: '0x1f184E5CC0EDE2eFd67a3cE51dB1347A2C3dC1c8',
  // add more if needed
};

// only reject undefined/null (allow 0)
function req(x, m) {
  if (x === undefined || x === null) throw new Error(m);
  return x;
}

task(
    'pay-usdc-xchain',
    'CCTP v2 Fast with Hooks (receiver hardcoded by destination)')
    .addParam(
        'src',
        'source chain (ethereum|base|arbitrum|op|polygon|avalanche|linea)')
    .addParam('dst', 'destination chain')
    .addParam('amount', 'USDC amount, e.g. 2.0')
    .addOptionalParam('platform', 'handle platform, e.g. twitter')
    .addOptionalParam('username', 'handle username')
    .addOptionalParam('to', 'recipient address (skip handle lookup)')
    .addOptionalParam(
        'registry', 'HandleRegistry (for lookup on Base)',
        '0x132727D74dF3246b64046598626415258dc648f0')
    .addOptionalParam(
        'resolveRpc', 'RPC used for handle lookup', 'https://mainnet.base.org')
    .addOptionalParam('pk', 'private key hex (no 0x)')
    .addOptionalParam('minFinality', '1000 Fast | 2000 Finalized', '1000')
    .addOptionalParam('srcRpc', 'override source RPC')
    .addOptionalParam('dstRpc', 'override dest RPC')
    .addOptionalParam('tx', 'existing burn tx hash to resume')
    .addOptionalParam('hookData', '0x… custom payload (auto-built if omitted)')
    .addFlag('noHook', 'fallback to classic depositForBurn (no custom event)')
    .setAction(async (args, hre) => {
      const {ethers} = hre;

      const srcKey = args.src.toLowerCase();
      const dstKey = args.dst.toLowerCase();
      const srcDomain = DOMAINS[srcKey];
      if (srcDomain === undefined) throw new Error('Unsupported --src');
      const dstDomain = DOMAINS[dstKey];
      if (dstDomain === undefined) throw new Error('Unsupported --dst');

      const srcRpc = args.srcRpc || RPCS[srcKey];
      const dstRpc = args.dstRpc || RPCS[dstKey];
      req(srcRpc, `No RPC for ${srcKey}`);
      req(dstRpc, `No RPC for ${dstKey}`);

      const usdcSrc =
          ethers.getAddress(req(USDC[srcKey], `USDC not mapped for ${srcKey}`));

      const srcProvider = new ethers.JsonRpcProvider(srcRpc);
      const dstProvider = new ethers.JsonRpcProvider(dstRpc);

      const signer = args.pk ? new ethers.Wallet('0x' + args.pk) :
                               (await ethers.getSigners())[0];
      const srcSigner = signer.connect(srcProvider);
      const dstSigner = signer.connect(dstProvider);

      // 1) Resolve recipient
      let recipient = args.to;
      if (!recipient) {
        req(args.platform, 'Provide --to or --platform');
        req(args.username, 'Provide --to or --username');
        const resolveProvider = new ethers.JsonRpcProvider(args.resolveRpc);
        const reg =
            new ethers.Contract(args.registry, REG_ABI, resolveProvider);
        const member =
            await reg.getMemberByHandle(args.platform, args.username);
        if (!member.isActive) throw new Error('Member not active');
        recipient = member.wallet;
      }
      console.log(`Recipient on ${dstKey}: ${recipient}`);

      // 2) Amount & contracts
      const usdc = new ethers.Contract(usdcSrc, IERC20_ABI, srcSigner);
      const dec = await usdc.decimals();  // should be 6
      const amt = ethers.parseUnits(args.amount, dec);

      const messenger = new ethers.Contract(
          TOKEN_MESSENGER_V2, TOKEN_MESSENGER_V2_ABI, srcSigner);

      // 3) Fresh burn or resume
      const minFinality = parseInt(args.minFinality || '1000', 10);
      let burnTxHash = args.tx;

      if (!burnTxHash) {
        // fees
        const feeUrl = `https://iris-api.circle.com/v2/burn/USDC/fees/${
            srcDomain}/${dstDomain}`;
        const feeRes = await fetch(feeUrl);
        if (!feeRes.ok) throw new Error(`Fee API failed: ${feeRes.status}`);
        const minFeeBps = BigInt((await feeRes.json())?.data?.minimumFee ?? 0);
        const maxFee = (amt * minFeeBps) / 10000n;
        console.log(`minFeeBps=${minFeeBps} → maxFee=${maxFee}`);

        // approve
        const owner = await srcSigner.getAddress();
        const allowance = await usdc.allowance(owner, TOKEN_MESSENGER_V2);
        if (allowance < amt) {
          const txA = await usdc.approve(TOKEN_MESSENGER_V2, amt);
          console.log('approve tx:', txA.hash);
          await txA.wait();
        }

        const mintRecipient32 = ethers.zeroPadValue(recipient, 32);

        let txB;
        if (args.noHook) {
          console.log('depositForBurn (no hook)…');
          txB = await messenger.depositForBurn(
              amt, dstDomain, mintRecipient32, usdcSrc, ethers.ZeroHash, maxFee,
              minFinality);
        } else {
          const hookReceiver =
              req(DST_HOOK[dstKey],
                  `No hook receiver configured for dst=${dstKey}`);
          const destinationCaller = ethers.zeroPadValue(hookReceiver, 32);

          // auto-build hookData if omitted: ("HPAY", platform, username,
          // amount6)
          let hookData = args.hookData;
          if (!hookData) {
            req(args.platform, 'platform required to auto-build hookData');
            req(args.username, 'username required to auto-build hookData');
            const coder = new ethers.AbiCoder();
            hookData = coder.encode(
                ['string', 'string', 'string', 'uint256'],
                ['HPAY', args.platform, args.username, amt]);
          }

          console.log(`depositForBurnWithHook → receiver=${
              hookReceiver} (hookData bytes=${(hookData.length - 2) / 2})…`);
          txB = await messenger.depositForBurnWithHook(
              amt, dstDomain, mintRecipient32, usdcSrc, destinationCaller,
              maxFee, minFinality, hookData);
        }

        console.log('burn tx:', txB.hash);
        await txB.wait();
        burnTxHash = txB.hash;
        console.log('burn mined');
      } else {
        console.log('Resuming with existing burn tx:', burnTxHash);
      }

      // 4) Poll attestation (fixed 5s delay; never times out)
      const pollUrl = `https://iris-api.circle.com/v2/messages/${
          srcDomain}?transactionHash=${burnTxHash}`;
      console.log('Fetching attestation… (fixed 5s polling; Ctrl+C to abort)');
      let message, attestation;
      const started = Date.now();
      const delayMs = 5000;
      let lastState = '';

      // eslint-disable-next-line no-constant-condition
      while (true) {
        try {
          const r = await fetch(pollUrl);
          if (!r.ok) {
            console.log(`[attestation] HTTP ${r.status}; retrying in ${
                delayMs / 1000}s`);
          } else {
            const j = await r.json();
            const m = (j.messages || [])[0] || {};
            const att = m.attestation;
            const msgHex = m.message;

            const state =
                att ? (att === 'PENDING' ? 'PENDING' : 'READY') : 'WAITING';
            if (state !== lastState) {
              const elapsed = Math.floor((Date.now() - started) / 1000);
              console.log(`[attestation] ${state} (elapsed ${elapsed}s)`);
              lastState = state;
            }

            if (att && att !== 'PENDING' && msgHex && msgHex !== '0x') {
              message = msgHex;
              attestation = '0x' + String(att).replace(/^0x/, '');
              break;  // ✅ ready
            }
          }
        } catch (e) {
          console.log(`[attestation] error: ${e?.message || e}; retrying in ${
              delayMs / 1000}s`);
        }
        await new Promise(res => setTimeout(res, delayMs));
      }
      console.log('attestation OK');

      // 5) Finalize on destination
      if (args.noHook) {
        const transmitter = new ethers.Contract(
            MESSAGE_TRANSMITTER_V2, MESSAGE_TRANSMITTER_V2_ABI, dstSigner);
        const txM = await transmitter.receiveMessage(message, attestation);
        console.log('mint tx:', txM.hash);
        await txM.wait();
      } else {
        const hookReceiver = req(
            DST_HOOK[dstKey], `No hook receiver configured for dst=${dstKey}`);
        const receiver =
            new ethers.Contract(hookReceiver, RECEIVER_ABI, dstSigner);
        const txM = await receiver.mintAndLog(message, attestation);
        console.log('mint+log tx:', txM.hash);
        await txM.wait();
      }

      console.log(`✅ Minted ${args.amount} USDC on ${dstKey}`);
    });
