import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ethers } from "hardhat";

const toB32 = (a: string) => ethers.utils.hexZeroPad(a, 32);

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, network } = hre;
  const local = (await deployments.get("OAppPing")).address;

  // fill after you deploy both sides
  const REMOTE_ETH = process.env.PING_SEPOLIA!;
  const REMOTE_BASE = process.env.PING_BASE_SEPOLIA!;

  const remoteAddr =
    network.name === "sepolia" ? REMOTE_BASE :
    network.name === "base-sepolia" ? REMOTE_ETH :
    (() => { throw new Error("unknown network"); })();

  const remoteEid =
    network.name === "sepolia" ? Number(process.env.LZ_EID_BASE_SEPOLIA) :
    Number(process.env.LZ_EID_SEPOLIA);

  if (!remoteAddr) throw new Error("missing remote address in .env");

  const ping = await ethers.getContractAt("OAppPing", local);
  const tx = await (ping as any).setPeer(remoteEid, toB32(remoteAddr));
  await tx.wait(1);
  console.log(`setPeer(${remoteEid}, ${remoteAddr}) on ${network.name}`);
};
export default func;
func.tags = ["SetPeer"];
func.dependencies = ["Ping"];
