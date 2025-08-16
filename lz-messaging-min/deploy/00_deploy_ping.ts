import { DeployFunction } from 'hardhat-deploy/types';
import { deployments, ethers, getNamedAccounts, network } from 'hardhat';

const ENDPOINTS: Record<string, string> = {
  sepolia: '0x1a44076050125825900e736c501f859c50fE728c',
  'base-sepolia': '0x1a44076050125825900e736c501f859c50fE728c',
};

const EP_MIN_ABI = [
  'function eid() view returns (uint32)',
];

const func: DeployFunction = async (hre) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const net = hre.network.name;

  console.log('>>> network:', net);

  const endpoint = ENDPOINTS[net];
  if (!endpoint) throw new Error(`No EndpointV2 mapping for network "${net}"`);

  // 1) Check the endpoint really exists on your RPC
  const code = await ethers.provider.getCode(endpoint);
  console.log('EndpointV2:', endpoint, 'codeIsEmpty?', code === '0x');
  if (code === '0x') {
    throw new Error(
      `EndpointV2 not found at ${endpoint} on ${net}. ` +
      `This is almost always an RPC issue — switch to Alchemy/Infura for ${net}.`
    );
  }

  // Optional: print eid to confirm you’re on the right chain
  const ep = new ethers.Contract(endpoint, EP_MIN_ABI, (await ethers.getSigners())[0]);
  console.log('eid =', (await ep.eid()).toString());

  // 2) Deploy your OApp with (endpoint, owner)
  await deploy('OAppPing', {
    from: deployer,
    args: [endpoint, deployer],
    log: true,
    skipIfAlreadyDeployed: true,
  });
};

export default func;
func.tags = ['Ping'];
