import "dotenv/config";
import { ethers } from "hardhat";

// ~200k lzReceive gas option (common demo default)
const OPTIONS_200K = "0x0003010011010000000000000000000000000000000000000000000000030d40";

async function main() {
  const dst = process.argv[2]; // "base" or "eth"
  const dstEid = dst === "base"
    ? Number(process.env.LZ_EID_BASE_SEPOLIA)
    : Number(process.env.LZ_EID_SEPOLIA);

  const ping = await ethers.getContract("OAppPing");
  const count = Math.floor(Math.random() * 1000);

  const fee = await (ping as any).quote(dstEid, count, OPTIONS_200K, false);
  console.log("nativeFee:", fee.nativeFee.toString());

  const tx = await (ping as any).send(dstEid, count, OPTIONS_200K, { value: fee.nativeFee });
  console.log("send tx:", tx.hash);
  await tx.wait(1);
  console.log("✅ sent", count);
}
main().catch((e)=>{ console.error(e); process.exit(1); });
