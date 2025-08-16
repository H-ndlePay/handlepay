const { EndpointId } = require('@layerzerolabs/lz-definitions');

const endpointV2Address = {
  [EndpointId.SEPOLIA_V2_TESTNET]: '0x6EDCE65403992e310A62460808c4b910D972f10f',
  [EndpointId.OPTSEP_V2_TESTNET]: '0x6EDCE65403992e310A62460808c4b910D972f10f', 
  [EndpointId.ARBSEP_V2_TESTNET]: '0x6EDCE65403992e310A62460808c4b910D972f10f',
  [EndpointId.AVALANCHE_V2_TESTNET]: '0x6EDCE65403992e310A62460808c4b910D972f10f',
};

module.exports = async ({ getNamedAccounts, deployments, network }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  
  console.log(`Deploying MyOApp to ${network.name} with account: ${deployer}`);
  
  // Get the network's endpoint ID
  const eid = network.config.eid;
  const endpointAddress = endpointV2Address[eid];
  
  if (!endpointAddress) {
    throw new Error(`No LayerZero endpoint address for network ${network.name} (EID: ${eid})`);
  }
  
  console.log(`Using LayerZero endpoint: ${endpointAddress}`);
  
  const result = await deploy('MyOApp', {
    from: deployer,
    args: [endpointAddress, deployer],
    log: true,
    waitConfirmations: 1,
  });
  
  console.log(`MyOApp deployed at: ${result.address}`);
};

module.exports.tags = ['MyOApp'];