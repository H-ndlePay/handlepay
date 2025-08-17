import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const ENDPOINT_V2 = "0x1a44076050125825900e736c501f859c50fE728c"; // LZ v2 Endpoint

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts, network, ethers } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  log(`>>> network: ${network.name}`);

  if (network.name === "mainnet") {
    // Deploy the requester on Ethereum mainnet
    await deploy("Requester", {
      from: deployer,
      args: [ENDPOINT_V2],
      log: true,
      waitConfirmations: 2,
    });
  } else if (network.name === "base") {
    // Deploy the pay station on Base mainnet
    await deploy("PayStation", {
      from: deployer,
      args: [ENDPOINT_V2],
      log: true,
      waitConfirmations: 2,
    });
  } else {
    log("This script only targets mainnet & base.");
  }
};
export default func;
func.tags = ["Core"];
