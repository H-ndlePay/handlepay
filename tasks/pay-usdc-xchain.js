// tasks/pay-usdc-xchain.js
const { task } = require("hardhat/config");

// Node 18+ has global fetch
if (typeof fetch !== "function") {
  throw new Error("Node 18+ required (global fetch)");
}

const IERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner,address spender) view returns (uint256)",
  "function approve(address spender,uint256 value) returns (bool)"
];

const REG_ABI = [
  "function getMemberByHandle(string,string) view returns (tuple(uint256 id,address wallet,uint256 joinedBlock,bool isActive))"
];

const TOKEN_MESSENGER_V2_ABI = [
  "function depositForBurn(uint256 amount,uint32 destinationDomain,bytes32 mintRecipient,address burnToken,bytes32 destinationCaller,uint256 maxFee,uint32 minFinalityThreshold) external"
];
const MESSAGE_TRANSMITTER_V2_ABI = [
  "function receiveMessage(bytes message, bytes attestation) external returns (bool)"
];

// Circle CCTP v2 EVM domain IDs (mainnet)
const DOMAINS = {
  ethereum: 0,
  avalanche: 1,
  op: 2,         // Optimism
  arbitrum: 3,
  base: 6,
  polygon: 7,    // PoS
  linea: 11,
  // add more if you extend
};

// Default public RPCs (override with --srcRpc/--dstRpc if rate-limited)
const DEFAULT_RPCS = {
  ethereum: "https://eth.llamarpc.com",
  base: "https://mainnet.base.org",
  arbitrum: "https://arb1.arbitrum.io/rpc",
  op: "https://mainnet.optimism.io",
  polygon: "https://polygon-bor.publicnode.com",
  avalanche: "https://api.avax.network/ext/bc/C/rpc",
  linea: "https://rpc.linea.build",
};

// USDC mainnet addresses (extend as needed)
const USDC = {
  ethereum: "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  base:     "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  arbitrum: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  op:       "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
  polygon:  "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
  avalanche:"0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
  linea:    "0x176211869cA2b568f2A7D4EE941E073a821EE1ff",
};

// CCTP v2 proxies (addresses are the same across supported EVM chains)
const TOKEN_MESSENGER_V2 = "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d";
const MESSAGE_TRANSMITTER_V2 = "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64";

function requireKey(k, msg) { if (!k) throw new Error(msg); return k; }

task("pay-usdc-xchain", "Cross-chain USDC to a @handle via CCTP v2 Fast Transfer")
  .addParam("src", "source chain key (ethereum|base|arbitrum|op|polygon|avalanche|linea)")
  .addParam("dst", "destination chain key (same keys)")
  .addParam("amount", "USDC amount like 12.34")
  .addOptionalParam("platform", "handle platform (e.g. twitter)")
  .addOptionalParam("username", "handle username (e.g. Cookiestroke)")
  .addOptionalParam("to", "recipient address (skip handle lookup)")
  .addOptionalParam("registry", "HandleRegistry on Base (for lookup)", "0x132727D74dF3246b64046598626415258dc648f0")
  .addOptionalParam("resolveRpc", "RPC used for handle lookup (default Base)", "https://mainnet.base.org")
  .addOptionalParam("pk", "Private key (hex, no 0x)")
  .addOptionalParam("minFinality", "1000 (Fast) or 2000 (Standard)", "1000")
  .addOptionalParam("srcRpc", "Override source RPC")
  .addOptionalParam("dstRpc", "Override destination RPC")
  .setAction(async (args, hre) => {
    const { ethers } = hre;

    const srcKey = args.src.toLowerCase();
    const dstKey = args.dst.toLowerCase();

    const srcDomain = DOMAINS[srcKey];
    const dstDomain = DOMAINS[dstKey];
    requireKey(srcDomain !== undefined, "Unsupported --src");
    requireKey(dstDomain !== undefined, "Unsupported --dst");

    const srcRpc = args.srcRpc || DEFAULT_RPCS[srcKey];
    const dstRpc = args.dstRpc || DEFAULT_RPCS[dstKey];
    requireKey(srcRpc, `No default RPC for src=${srcKey}, pass --srcRpc`);
    requireKey(dstRpc, `No default RPC for dst=${dstKey}, pass --dstRpc`);

    const srcProvider = new ethers.JsonRpcProvider(srcRpc);
    const dstProvider = new ethers.JsonRpcProvider(dstRpc);

    const signer = args.pk
      ? new ethers.Wallet("0x" + args.pk)
      : (await ethers.getSigners())[0];
    const srcSigner = signer.connect(srcProvider);
    const dstSigner = signer.connect(dstProvider);

    // 1) Resolve recipient
    let recipient = args.to;
    if (!recipient) {
      requireKey(args.platform, "Provide --to or --platform+--username");
      requireKey(args.username, "Provide --to or --platform+--username");
      const resolveProvider = new ethers.JsonRpcProvider(args.resolveRpc);
      const reg = new ethers.Contract(args.registry, REG_ABI, resolveProvider);
      const member = await reg.getMemberByHandle(args.platform, args.username);
      if (!member.isActive) throw new Error("Member not active");
      recipient = member.wallet;
    }
    console.log(`Recipient on ${dstKey}: ${recipient}`);

    // 2) Amount & contracts
    const usdcSrc = USDC[srcKey];
    requireKey(usdcSrc, `USDC not mapped for ${srcKey}`);

    const usdc = new ethers.Contract(usdcSrc, IERC20_ABI, srcSigner);
    const dec = await usdc.decimals();
    const amount = ethers.parseUnits(args.amount, dec);

    const messenger = new ethers.Contract(TOKEN_MESSENGER_V2, TOKEN_MESSENGER_V2_ABI, srcSigner);
    const transmitter = new ethers.Contract(MESSAGE_TRANSMITTER_V2, MESSAGE_TRANSMITTER_V2_ABI, dstSigner);

    // 3) Fee via Circle fees API (burn → mint)
    const feeUrl = `https://iris-api.circle.com/v2/burn/USDC/fees/${srcDomain}/${dstDomain}`;
    const feeRes = await fetch(feeUrl);
    if (!feeRes.ok) throw new Error(`Fee API failed: ${feeRes.status}`);
    const feeJson = await feeRes.json();
    const minFeeBps = BigInt(feeJson?.data?.minimumFee ?? 0);
    const maxFee = (amount * minFeeBps) / 10000n;
    const minFinality = parseInt(args.minFinality || "1000", 10); // 1000 = Fast
    console.log(`minFeeBps=${minFeeBps} → maxFee=${maxFee.toString()} (minFinality=${minFinality})`);

    // 4) Approve
    const owner = await srcSigner.getAddress();
    const allowance = await usdc.allowance(owner, TOKEN_MESSENGER_V2);
    if (allowance < amount) {
      console.log("Approving USDC to TokenMessengerV2…");
      const txA = await usdc.approve(TOKEN_MESSENGER_V2, amount);
      console.log("approve tx:", txA.hash);
      await txA.wait();
    }

    // 5) depositForBurn (destinationCaller=0x0 so anyone can submit receiveMessage)
    const mintRecipient32 = ethers.zeroPadValue(recipient, 32);
    console.log("depositForBurn…");
    const txB = await messenger.depositForBurn(
      amount,
      dstDomain,
      mintRecipient32,
      usdcSrc,
      "0x" + "00".repeat(64),
      maxFee,
      minFinality
    );
    console.log("burn tx:", txB.hash);
    const rcptB = await txB.wait();
    console.log("burn mined in block", rcptB.blockNumber);

    // 6) Poll attestation + message
    const pollUrl = `https://iris-api.circle.com/v2/messages/${srcDomain}?transactionHash=${txB.hash}`;
    console.log("Fetching attestation…");
    let message, attestation;
    for (let i = 0; i < 60; i++) {
      const r = await fetch(pollUrl);
      const j = await r.json();
      const m = (j.messages || [])[0];
      if (m && m.attestation && m.attestation !== "PENDING" && m.message && m.message !== "0x") {
        message = m.message;
        attestation = "0x" + m.attestation.replace(/^0x/, "");
        break;
      }
      await new Promise((res) => setTimeout(res, 3000));
    }
    if (!message || !attestation) throw new Error("Timed out waiting for attestation");
    console.log("attestation OK");

    // 7) receiveMessage on destination
    console.log("receiveMessage on destination…");
    const txM = await transmitter.receiveMessage(message, attestation);
    console.log("mint tx:", txM.hash);
    const rcptM = await txM.wait();
    console.log(`✅ Minted ${args.amount} USDC on ${dstKey} in block ${rcptM.blockNumber}`);
  });
