const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  
  console.log("Deploying HandleRegistry with account:", deployer.address);
  
  // Fix: Use provider to get balance
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH");
  
  const HandleRegistry = await hre.ethers.getContractFactory("HandleRegistry");
  const registry = await HandleRegistry.deploy(deployer.address);
  
  // Fix: Wait for deployment
  await registry.waitForDeployment();
  
  // Fix: Get the address properly
  const address = await registry.getAddress();
  
  console.log("HandleRegistry deployed to:", address);
  
  // Save deployment info
  const network = hre.network.name;
  const deploymentInfo = {
    network: network,
    address: address,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
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
