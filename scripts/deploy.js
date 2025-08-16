const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  
  console.log("Deploying HandleRegistry with account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());
  
  const HandleRegistry = await hre.ethers.getContractFactory("HandleRegistry");
  const registry = await HandleRegistry.deploy(deployer.address);
  
  await registry.deployed();
  
  console.log("HandleRegistry deployed to:", registry.address);
  
  // Save deployment info
  const network = hre.network.name;
  const deploymentInfo = {
    network: network,
    address: registry.address,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    blockNumber: registry.deployTransaction.blockNumber
  };
  
  if (!fs.existsSync("deployments")) {
    fs.mkdirSync("deployments");
  }
  
  fs.writeFileSync(
    `deployments/${network}.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log("Deployment info saved to deployments/" + network + ".json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
