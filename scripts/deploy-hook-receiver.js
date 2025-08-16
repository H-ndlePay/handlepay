const { ethers } = require("hardhat");

const MESSAGE_TRANSMITTER_V2 = "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const F = await ethers.getContractFactory("HandlePayHookReceiver");
  const c = await F.deploy(MESSAGE_TRANSMITTER_V2);
  await c.waitForDeployment();
  console.log("HandlePayHookReceiver:", await c.getAddress());
}

main().catch((e) => { console.error(e); process.exit(1); });
