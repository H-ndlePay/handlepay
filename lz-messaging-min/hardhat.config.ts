import 'dotenv/config';
import 'hardhat-deploy';
import '@nomiclabs/hardhat-ethers';

const accounts = process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [];

module.exports = {
  solidity: '0.8.24',
  namedAccounts: { deployer: { default: 0 } },
  networks: {
    sepolia: {
      chainId: 11155111,
      url: process.env.SEPOLIA_RPC!,
      accounts,
    },
    'base-sepolia': {
      chainId: 84532,
      url: process.env.BASE_SEPOLIA_RPC!,
      accounts,
    },
  },
};
