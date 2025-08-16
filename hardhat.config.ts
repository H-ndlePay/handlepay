import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-ethers';
import '@layerzerolabs/toolbox-hardhat';
import 'hardhat-deploy';
import { EndpointId } from '@layerzerolabs/lz-definitions';
import * as dotenv from 'dotenv';

dotenv.config();

const accounts = process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.22',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  
  networks: {
    'ethereum-sepolia-testnet': {
      eid: EndpointId.SEPOLIA_V2_TESTNET,
      url: process.env.RPC_URL_SEPOLIA || 'https://sepolia.gateway.tenderly.co',
      accounts,
    },
    'optimism-sepolia-testnet': {
      eid: EndpointId.OPTSEP_V2_TESTNET,
      url: process.env.RPC_URL_OP_SEPOLIA || 'https://optimism-sepolia.gateway.tenderly.co',
      accounts,
    },
    'arbitrum-sepolia-testnet': {
      eid: EndpointId.ARBSEP_V2_TESTNET,
      url: process.env.RPC_URL_ARB_SEPOLIA || 'https://arbitrum-sepolia.gateway.tenderly.co',
      accounts,
    },
    'avalanche-fuji-testnet': {
      eid: EndpointId.AVALANCHE_V2_TESTNET,
      url: process.env.RPC_URL_FUJI || 'https://avalanche-fuji.drpc.org',
      accounts,
    },
  },
  
  namedAccounts: {
    deployer: {
      default: 0,
    },
  },
  
  external: {
    deployments: {
      'ethereum-sepolia-testnet': ['node_modules/@layerzerolabs/lz-evm-protocol-v2/deployments/sepolia-testnet'],
      'optimism-sepolia-testnet': ['node_modules/@layerzerolabs/lz-evm-protocol-v2/deployments/optimism-sepolia-testnet'],
      'arbitrum-sepolia-testnet': ['node_modules/@layerzerolabs/lz-evm-protocol-v2/deployments/arbitrum-sepolia-testnet'],
      'avalanche-fuji-testnet': ['node_modules/@layerzerolabs/lz-evm-protocol-v2/deployments/avalanche-testnet'],
    },
  },
};

export default config;