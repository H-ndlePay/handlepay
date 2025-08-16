# LayerZero Cross-Chain Integration

## Overview
This integration adds cross-chain messaging capabilities to HandlePay using LayerZero V2.

## Deployed Contracts
- **Ethereum Sepolia**: `0x6f0510fd68BAf52604151D704ddbC33c8742A7E5`
- **Base Mainnet**: `0x132727D74dF3246b64046598626415258dc648f0` (existing)

## Quick Start
```bash
# Install dependencies
pnpm install

# Compile contracts
pnpm compile

# Deploy to testnet
pnpm hardhat deploy --network ethereum-sepolia-testnet --tags MyOApp

# Test cross-chain messaging
pnpm hardhat lz:oapp:send --dst-eid 40232 --string "Hello!" --network ethereum-sepolia-testnet
Features

✅ Cross-chain messaging between any LayerZero supported chains
✅ Message tracking and statistics
✅ Gas estimation for cross-chain transactions
✅ Configurable execution options
✅ Support for ordered/unordered delivery

Next Steps

Deploy to additional networks (Base, Arbitrum, Optimism)
Wire cross-chain connections
Integrate with HandlePay core functionality
Add cross-chain token transfers

Architecture
┌─────────────┐    LayerZero V2    ┌─────────────┐
│   Chain A   │ ◄─────────────────► │   Chain B   │
│   MyOApp    │                    │   MyOApp    │
└─────────────┘                    └─────────────┘
