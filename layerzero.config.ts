import { EndpointId } from '@layerzerolabs/lz-definitions';
import { ExecutorOptionType } from '@layerzerolabs/lz-v2-utilities';
import { TwoWayConfig, generateConnectionsConfig } from '@layerzerolabs/metadata-tools';
import { OAppEnforcedOption, OmniPointHardhat } from '@layerzerolabs/toolbox-hardhat';

// ══════════════════════════════════════════════════════════════════════════════
// CONTRACT DEFINITIONS
// ══════════════════════════════════════════════════════════════════════════════

// Define your OApp deployments for each chain
// The config references the contract deployment from your ./deployments folder
const sepoliaContract: OmniPointHardhat = {
  eid: EndpointId.SEPOLIA_V2_TESTNET,
  contractName: 'MyOApp',
};

const optimismContract: OmniPointHardhat = {
  eid: EndpointId.OPTSEP_V2_TESTNET,
  contractName: 'MyOApp',
};

const arbitrumContract: OmniPointHardhat = {
  eid: EndpointId.ARBSEP_V2_TESTNET,
  contractName: 'MyOApp',
};

const avalancheContract: OmniPointHardhat = {
  eid: EndpointId.AVALANCHE_V2_TESTNET,
  contractName: 'MyOApp',
};

const polygonContract: OmniPointHardhat = {
  eid: EndpointId.AMOY_V2_TESTNET,
  contractName: 'MyOApp',
};

// ══════════════════════════════════════════════════════════════════════════════
// ENFORCED OPTIONS CONFIGURATION
// ══════════════════════════════════════════════════════════════════════════════

// For this example's simplicity, we will use the same enforced options values for sending to all chains
// For production, you should ensure `gas` is set to the correct value through profiling the gas usage 
// of calling OApp._lzReceive(...) on the destination chain
// To learn more, read https://docs.layerzero.network/v2/concepts/applications/oapp-standard#execution-options-and-enforced-settings

const EVM_ENFORCED_OPTIONS: OAppEnforcedOption[] = [
  {
    msgType: 1,                           // SEND message type
    optionType: ExecutorOptionType.LZ_RECEIVE,
    gas: 80000,                          // Gas limit for _lzReceive execution
    value: 0,                            // Native value to send (0 for most cases)
  },
];

// Different gas configurations for different chains if needed
const HIGH_GAS_ENFORCED_OPTIONS: OAppEnforcedOption[] = [
  {
    msgType: 1,
    optionType: ExecutorOptionType.LZ_RECEIVE,
    gas: 120000,                         // Higher gas for more complex operations
    value: 0,
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// PATHWAY CONFIGURATIONS
// ══════════════════════════════════════════════════════════════════════════════

// To connect all the above chains to each other, we need the following pathways:
// Sepolia <-> Optimism
// Sepolia <-> Arbitrum  
// Sepolia <-> Avalanche
// Sepolia <-> Polygon
// Optimism <-> Arbitrum
// Optimism <-> Avalanche
// Optimism <-> Polygon
// Arbitrum <-> Avalanche
// Arbitrum <-> Polygon
// Avalanche <-> Polygon

// With the config generator, pathways declared are automatically bidirectional
// i.e. if you declare A,B there's no need to declare B,A

const pathways: TwoWayConfig[] = [
  // Sepolia connections
  [
    sepoliaContract,                      // Chain A contract
    optimismContract,                     // Chain B contract
    [['LayerZero Labs'], []],             // [ requiredDVN[], [ optionalDVN[], threshold ] ]
    [1, 1],                              // [A to B confirmations, B to A confirmations]
    [EVM_ENFORCED_OPTIONS, EVM_ENFORCED_OPTIONS], // Chain B enforcedOptions, Chain A enforcedOptions
  ],
  [
    sepoliaContract,
    arbitrumContract,
    [['LayerZero Labs'], []],
    [1, 1],
    [EVM_ENFORCED_OPTIONS, EVM_ENFORCED_OPTIONS],
  ],
  [
    sepoliaContract,
    avalancheContract,
    [['LayerZero Labs'], []],
    [1, 1],
    [EVM_ENFORCED_OPTIONS, EVM_ENFORCED_OPTIONS],
  ],
  [
    sepoliaContract,
    polygonContract,
    [['LayerZero Labs'], []],
    [1, 1],
    [EVM_ENFORCED_OPTIONS, EVM_ENFORCED_OPTIONS],
  ],
  
  // Optimism connections (excluding already defined Sepolia)
  [
    optimismContract,
    arbitrumContract,
    [['LayerZero Labs'], []],
    [1, 1],
    [EVM_ENFORCED_OPTIONS, EVM_ENFORCED_OPTIONS],
  ],
  [
    optimismContract,
    avalancheContract,
    [['LayerZero Labs'], []],
    [1, 1],
    [EVM_ENFORCED_OPTIONS, EVM_ENFORCED_OPTIONS],
  ],
  [
    optimismContract,
    polygonContract,
    [['LayerZero Labs'], []],
    [1, 1],
    [EVM_ENFORCED_OPTIONS, EVM_ENFORCED_OPTIONS],
  ],
  
  // Arbitrum connections (excluding already defined)
  [
    arbitrumContract,
    avalancheContract,
    [['LayerZero Labs'], []],
    [1, 1],
    [EVM_ENFORCED_OPTIONS, EVM_ENFORCED_OPTIONS],
  ],
  [
    arbitrumContract,
    polygonContract,
    [['LayerZero Labs'], []],
    [1, 1],
    [EVM_ENFORCED_OPTIONS, EVM_ENFORCED_OPTIONS],
  ],
  
  // Avalanche connections (excluding already defined)
  [
    avalancheContract,
    polygonContract,
    [['LayerZero Labs'], []],
    [1, 1],
    [EVM_ENFORCED_OPTIONS, EVM_ENFORCED_OPTIONS],
  ],
];

// ══════════════════════════════════════════════════════════════════════════════
// EXPORT CONFIGURATION
// ══════════════════════════════════════════════════════════════════════════════

export default async function () {
  // Generate the connections config based on the pathways
  const connections = await generateConnectionsConfig(pathways);
  
  return {
    contracts: [
      { contract: sepoliaContract },
      { contract: optimismContract },
      { contract: arbitrumContract },
      { contract: avalancheContract },
      { contract: polygonContract },
    ],
    connections,
  };
}