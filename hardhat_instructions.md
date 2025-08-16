# Installing Hardhat

## Initialize Node project

npm init -y

## Install Hardhat and dependencies

npm install --save-dev hardhat
npm install --save-dev @nomicfoundation/hardhat-toolbox
npm install --save-dev @openzeppelin/contracts
npm install --save-dev dotenv

## Initialize Hardhat (choose "Create an empty hardhat.config.js")

npx hardhat init

## Install LayerZero packages (for later)

npm install --save-dev @layerzerolabs/lz-evm-oapp-v2
