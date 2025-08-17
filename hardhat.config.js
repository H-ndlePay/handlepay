require("./tasks/manage-member");
require("./tasks/pay-eth");
require("./tasks/pay-usdc-xchain");
require("./tasks/pay-usdc-extension");
require("./tasks/debug-usdc-extension");
require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-verify");
require("dotenv").config();

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
    },
  },
  networks: {
    hardhat: { chainId: 1337 },
    base: {
      url: "https://mainnet.base.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 8453,
    },
    ethereum: {
      url: "https://eth.llamarpc.com",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 1,
    },
    baseSepolia: {
      url: "https://sepolia.base.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 84532,
    },
  },
  // Single V2 key for all Etherscan-based explorers (incl. Base)
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || "",
  },
  // Optional: silence Sourcify warning
  sourcify: { enabled: false },
};
