// tasks/pay-usdc-xchain.js
const { task } = require("hardhat/config");

// Node 18+ has global fetch
if (typeof fetch !== "function") throw new Error("Node 18+ required (global fetch)");

const IERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner,address spender) view returns (uint256)",
  "function approve(address spender,uint256 value) returns (bool)",
];

const REG_ABI = [
  "function getMemberByHandle(string,string) view returns (tuple(uint256 id,address wallet,uint256 joinedBlock,bool isActive))",
];

// CCTP v2 ABIs
const TOKEN_MESSENGER_V2_ABI = [
  // depositForBurn(amount, dstDomain, mintRecipient, burnToken, destinationCaller, maxFee, minFinalityThreshold)
  "function depositForBurn(uint256,uint32,bytes32,address,bytes32,uint256,uint32) external",
];

const MESSAGE_TRANSMITTER_V2_ABI = [
  "function receiveMessage(bytes message, bytes attestation) external returns (bool)",
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
};

// Default public RPCs
const RPCS = {
  ethereum: "https://eth.llamarpc.com",
  base: "https://mainnet.base.org",
  arbitrum: "https://arb1.arbitrum.io/rpc",
  op: "https://mainnet.optimism.io",
  polygon: "https://polygon-bor.publicnode.com",
  avalanche: "https://api.avax.network/ext/bc/C/rpc",
  linea: "https://rpc.linea.build",
};

// USDC mainnet
const USDC = {
  ethereum: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  arbitrum: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  op: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
  polygon: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
  avalanche: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
  linea: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff",
};

// CCTP v2 contracts (same on supported EVMs)
const TOKEN_MESSENGER_V2 = "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d";
const MESSAGE_TRANSMITTER_V2 = "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64";

function req(x, m) {
  if (x === undefined || x === null) throw new Error(m);
  return x;
}

function addressToBytes32(ethers, addr) {
  // bytes32 with address in the LOW 20 bytes (left-padded with zeros)
  return ethers.hexlify(ethers.zeroPadValue(ethers.getAddress(addr), 32));
}

task("pay-usdc-xchain", "CCTP v2 cross-chain USDC (no hooks)")
  .addParam("src", "source chain (ethereum|base|arbitrum|op|polygon|avalanche|linea)")
  .addParam("dst", "destination chain")
  .addParam("amount", "USDC amount, e.g. 2.0")
  .addOptionalParam("platform", "handle platform (e.g. twitter)")
  .addOptionalParam("username", "handle username")
  .addOptionalParam("to", "recipient address (skip handle lookup)")
  .addOptionalParam("registry", "HandleRegistry on Base (for lookup)", "0x132727D74dF3246b64046598626415258dc648f0")
  .addOptionalParam("resolveRpc", "RPC used for handle lookup (default Base)", "https://mainnet.base.org")
  .addOptionalParam("pk", "Private key (hex, no 0x)")
  .addOptionalParam("minFinality", "1000 (Fast) or 2000 (Standard)", "1000")
  .addOptionalParam("srcRpc", "Override source RPC")
  .addOptionalParam("dstRpc", "Override destination RPC")
  .addOptionalParam("tx", "existing burn tx hash (resume mint)")
  .setAction(async (args, hre) => {
    const { ethers } = hre;

    const srcKey = args.src.toLowerCase();
    const dstKey = args.dst.toLowerCase();
    const srcDomain = DOMAINS[srcKey];
    const dstDomain = DOMAINS[dstKey];
    if (srcDomain === undefined) throw new Error("Unsupported --src");
    if (dstDomain === undefined) throw new Error("Unsupported --dst");

    const srcRpc = args.srcRpc || RPCS[srcKey];
    const dstRpc = args.dstRpc || RPCS[dstKey];
    req(srcRpc, `No RPC for ${srcKey}`);
    req(dstRpc, `No RPC for ${dstKey}`);

    const usdcSrc = ethers.getAddress(req(USDC[srcKey], `USDC not mapped for ${srcKey}`));

    const srcProvider = new ethers.JsonRpcProvider(srcRpc);
    const dstProvider = new ethers.JsonRpcProvider(dstRpc);

    const signer = args.pk ? new ethers.Wallet("0x" + args.pk) : (await ethers.getSigners())[0];
    const srcSigner = signer.connect(srcProvider);
    const dstSigner = signer.connect(dstProvider);

    // 1) Resolve recipient
    let recipient = args.to;
    if (!recipient) {
      req(args.platform, "Provide --to or --platform");
      req(args.username, "Provide --to or --username");
      const resolveProvider = new ethers.JsonRpcProvider(args.resolveRpc);
      const reg = new ethers.Contract(args.registry, REG_ABI, resolveProvider);
      const member = await reg.getMemberByHandle(args.platform, args.username);
      if (!member.isActive) throw new Error("Member not active");
      recipient = member.wallet;
    }
    console.log(`Recipient on ${dstKey}: ${recipient}`);

    // 2) Amount & contracts
    const usdc = new ethers.Contract(usdcSrc, IERC20_ABI, srcSigner);
    const dec = await usdc.decimals();
    const amt = ethers.parseUnits(args.amount, dec);

    const messenger = new ethers.Contract(TOKEN_MESSENGER_V2, TOKEN_MESSENGER_V2_ABI, srcSigner);
    const transmitter = new ethers.Contract(MESSAGE_TRANSMITTER_V2, MESSAGE_TRANSMITTER_V2_ABI, dstSigner);

    // 3) Fresh burn or resume
    const minFinality = parseInt(args.minFinality || "1000", 10);
    let burnTxHash = args.tx;

    if (!burnTxHash) {
      // fees (v2)
      const feeUrl = `https://iris-api.circle.com/v2/burn/USDC/fees/${srcDomain}/${dstDomain}`;
      const feeRes = await fetch(feeUrl);
      if (!feeRes.ok) throw new Error(`Fee API failed: ${feeRes.status}`);
      const feeJson = await feeRes.json();
      const minFeeBps = BigInt(feeJson?.data?.minimumFee ?? 0);
      const maxFee = (amt * minFeeBps) / 10000n;
      console.log(`minFeeBps=${minFeeBps} → maxFee=${maxFee.toString()} (minFinality=${minFinality})`);

      // approve
      const owner = await srcSigner.getAddress();
      const allowance = await usdc.allowance(owner, TOKEN_MESSENGER_V2);
      if (allowance < amt) {
        console.log("Approving USDC to TokenMessengerV2…");
        const txA = await usdc.approve(TOKEN_MESSENGER_V2, amt);
        console.log("approve tx:", txA.hash);
        await txA.wait();
      }

      // depositForBurn (NO HOOKS): destinationCaller = bytes32(0)
      const mintRecipient32 = ethers.zeroPadValue(recipient, 32);
      const destinationCaller = ethers.ZeroHash;

      console.log("depositForBurn (v2, no hooks) …");
      const txB = await messenger.depositForBurn(
        amt,
        dstDomain,
        mintRecipient32,
        usdcSrc,
        destinationCaller,
        maxFee,
        minFinality
      );
      console.log("burn tx:", txB.hash);
      await txB.wait();
      burnTxHash = txB.hash;
      console.log("burn mined");
    } else {
      console.log("Resuming with existing burn tx:", burnTxHash);
    }

    // 4) Poll attestation + message (v2, fixed 5s, no timeout)
    const pollUrl = `https://iris-api.circle.com/v2/messages/${srcDomain}?transactionHash=${burnTxHash}`;
    console.log("Fetching attestation… (fixed 5s polling; Ctrl+C to abort)");
    let message, attestation;
    const started = Date.now();
    const delayMs = 5000;
    let lastState = "";

    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        const r = await fetch(pollUrl);
        if (!r.ok) {
          console.log(`[attestation] HTTP ${r.status}; retrying in ${delayMs / 1000}s`);
        } else {
          const j = await r.json();
          const m = (j.messages || [])[0];
          const att = m?.attestation;
          const msgHex = m?.message;

          const state = att ? (att === "PENDING" ? "PENDING" : "READY") : "WAITING";
          if (state !== lastState) {
            const elapsed = Math.floor((Date.now() - started) / 1000);
            console.log(`[attestation] ${state} (elapsed ${elapsed}s)`);
            lastState = state;
          }

          if (att && att !== "PENDING" && msgHex && msgHex !== "0x") {
            message = msgHex;
            attestation = "0x" + String(att).replace(/^0x/, "");
            break; // ready
          }
        }
      } catch (e) {
        console.log(`[attestation] error: ${e?.message || e}; retrying in ${delayMs / 1000}s`);
      }
      await new Promise((res) => setTimeout(res, delayMs));
    }
    console.log("attestation OK");

    // 5) (Safety) Decode v2 envelope to ensure destinationCaller == 0
    const coder = new ethers.AbiCoder();
    // (uint32 version,uint32 srcDomain,uint32 dstDomain,bytes32 nonce,bytes32 messageSenderB32,bytes32 mintRecipientB32,bytes32 destinationCallerB32,uint32 minFinality,uint32 finalityExecuted,bytes body)
    const decoded = coder.decode(
      ["uint32","uint32","uint32","bytes32","bytes32","bytes32","bytes32","uint32","uint32","bytes"],
      message
    );
    const destinationCallerB32 = decoded[6];
    const isZeroDestCaller = /^0x0+$/.test(destinationCallerB32.toLowerCase());
    if (!isZeroDestCaller) {
      throw new Error(
        `This burn used a non-zero destinationCaller (i.e., a hook). It cannot be finalized via no-hooks path.`
      );
    }

    // 6) Finalize on destination (no hooks → direct to transmitter)
    console.log("receiveMessage on destination…");
    const txM = await transmitter.receiveMessage(message, attestation);
    console.log("mint tx:", txM.hash);
    const rcptM = await txM.wait();
    console.log(`✅ Minted ${args.amount} USDC on ${dstKey} in block ${rcptM.blockNumber}`);
  });
