import "dotenv/config";
import "hardhat-deploy";
import "@nomiclabs/hardhat-ethers";
import { task } from "hardhat/config";

const {
  RPC_URL_MAINNET,
  RPC_URL_BASE,
  DEPLOYER_PK,
  PRIVATE_KEY,        // fallback
  LZ_ENDPOINT_MAINNET,
  LZ_ENDPOINT_BASE,
} = process.env;

const pk = DEPLOYER_PK || PRIVATE_KEY;
const accounts = pk ? [pk] : [];

task("who", "Print deployer")
  .setAction(async (_args, { ethers }) => {
    const [s] = await ethers.getSigners();
    console.log("deployer:", s ? await s.getAddress() : "(no signer)");
  });

task("balance", "Print account balance")
  .addParam("account")
  .setAction(async ({ account }, { ethers, network }) => {
    const bal = await ethers.provider.getBalance(account);
    console.log(network.name, account, ethers.utils.formatEther(bal), "ETH");
  });

export default {
  namedAccounts: { deployer: { default: 0 } },
  networks: {
    mainnet: { url: RPC_URL_MAINNET!, accounts },
    base:    { url: RPC_URL_BASE!,    accounts, chainId: 8453 },
  },
  solidity: "0.8.24",
};
