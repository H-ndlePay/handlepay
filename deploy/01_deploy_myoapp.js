const { ethers } = require('hardhat');

module.exports = async ({ getNamedAccounts, deployments, network }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  
  console.log(`\nDeploying to ${network.name}`);
  console.log(`Deployer: ${deployer}`);
  
  // LayerZero V2 Endpoint addresses (same for all testnets)
  const endpointAddress = '0x6EDCE65403992e310A62460808c4b910D972f10f';
  
  const result = await deploy('MyOApp', {
    from: deployer,
    args: [endpointAddress, deployer],
    log: true,
    waitConfirmations: 1,
  });
  
  console.log(`✅ MyOApp deployed to: ${result.address}`);
  
  return result;
};

module.exports.tags = ['MyOApp'];