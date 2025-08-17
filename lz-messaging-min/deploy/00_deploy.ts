// deploy/00_deploy.ts
import type { DeployFunction } from "hardhat-deploy/types";
import type { HardhatRuntimeEnvironment } from "hardhat/types";

const ENDPOINTS: Record<string, string | undefined> = {
  mainnet: process.env.LZ_ENDPOINT_MAINNET || "0x1a44076050125825900e736c501f859c50fE728c",
  base:    process.env.LZ_ENDPOINT_BASE    || "0x1a44076050125825900e736c501f859c50fE728c",
};

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts, ethers, network } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  log(`>>> network: ${network.name}`);

  if (!deployer) throw new Error("No deployer signer. Set DEPLOYER_PK or PRIVATE_KEY in your env.");

  const endpoint = ENDPOINTS[network.name];
  if (!endpoint) throw new Error(`Missing LZ endpoint for ${network.name}`);

  try {
    const code = await ethers.provider.getCode(endpoint);
    log(`EndpointV2: ${endpoint}  code? ${code !== "0x"}`);
  } catch (e) {
    log(`EndpointV2: ${endpoint}  (skipping code check due to RPC error)`);
  }
    await deploy("PayStation", {
    from: deployer,
    args: [endpoint],            // ← only the endpoint
    log: true,
    });
};

export default func;
func.tags = ["Core"];
