// scripts/deploy-hook-receiver.js
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Correct MessageTransmitterV2 for mainnet/v2 (same on Base, Ethereum, etc.)
  const MTV2 = "0xec546b6B005471ECf012e5aF77FBeC07e0FD8f78";

  const F = await hre.ethers.getContractFactory("HandlePayHookReceiver");
  const r = await F.deploy(MTV2);
  await r.waitForDeployment();
  console.log("HandlePayHookReceiver:", await r.getAddress());
}

main().catch(console.error);
