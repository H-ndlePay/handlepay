// scripts/deploy-hook-receiver.js
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Correct MessageTransmitterV2 for mainnet/v2 (same on Base, Ethereum, etc.)
  const MTV2 = "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64";

  const F = await hre.ethers.getContractFactory("HandlePayHookReceiver");
  const r = await F.deploy(MTV2);
  await r.waitForDeployment();
  console.log("HandlePayHookReceiver:", await r.getAddress());
}

main().catch(console.error);
