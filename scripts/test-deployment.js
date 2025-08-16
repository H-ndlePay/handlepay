const { ethers } = require('hardhat');
const fs = require('fs');

async function main() {
  console.log("🧪 Testing deployed MyOApp contract...\n");
  
  const network = hre.network.name;
  console.log(`📡 Network: ${network}`);
  
  // Read deployment info
  const deploymentPath = `./deployments/${network}/MyOApp.json`;
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`No deployment found at ${deploymentPath}`);
  }
  
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  const contractAddress = deployment.address;
  
  console.log(`📝 Contract address: ${contractAddress}`);
  
  // Get contract instance
  const MyOApp = await ethers.getContractFactory('MyOApp');
  const oapp = MyOApp.attach(contractAddress);
  
  try {
    // Test basic functions
    console.log("\n📊 Testing contract functions...");
    
    const stats = await oapp.getStats();
    console.log(`   Messages sent: ${stats.sent}`);
    console.log(`   Messages received: ${stats.received}`);
    console.log(`   Last message: "${stats.lastMsg}"`);
    
    // Test quote function to OP Sepolia (EID: 40232)
    console.log("\n💰 Testing fee quote...");
    const fee = await oapp.quoteSendString(
      40232, // OP Sepolia EID
      "Hello from Sepolia!",
      "0x", // empty options
      false // pay in native token
    );
    
    console.log(`   Estimated fee: ${ethers.formatEther(fee.nativeFee)} ETH`);
    
    console.log("\n✅ Contract is working correctly!");
    
  } catch (error) {
    console.error("❌ Error testing contract:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });