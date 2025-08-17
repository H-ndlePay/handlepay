// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IHandleRegistry {
    function getMemberByHandle(string memory platform, string memory username) 
        external view returns (uint256 id, address wallet, uint256 joinedBlock, bool isActive);
}

interface ITokenMessenger {
    function depositForBurn(
        uint256 amount,
        uint32 destinationDomain, 
        bytes32 mintRecipient,
        address burnToken
    ) external returns (uint64);
}

contract HandleRegistryUSDCExtension is Ownable {
    IHandleRegistry public immutable registry;
    
    // CCTP Configuration - CORRECTED FOR EACH NETWORK
    // These are the actual deployed addresses per network
    mapping(string => address) public tokenMessengerAddresses;
    mapping(string => uint32) public chainToDomain;
    mapping(string => address) public chainToUSDC;
    
    event USDCPaymentInitiated(
        string platform, 
        string username, 
        address from, 
        address to,
        uint256 amount, 
        string sourceChain,
        string destinationChain,
        bytes32 indexed burnTxHash
    );
    
    constructor(address _registry, address _owner) Ownable(_owner) {
        registry = IHandleRegistry(_registry);
        
        // Initialize CCTP domains
        chainToDomain["ethereum"] = 0;
        chainToDomain["avalanche"] = 1;
        chainToDomain["op"] = 2;
        chainToDomain["arbitrum"] = 3;
        chainToDomain["base"] = 6;
        chainToDomain["polygon"] = 7;
        
        // Initialize USDC addresses
        chainToUSDC["ethereum"] = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
        chainToUSDC["base"] = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
        chainToUSDC["arbitrum"] = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;
        chainToUSDC["op"] = 0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85;
        chainToUSDC["polygon"] = 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359;
        chainToUSDC["avalanche"] = 0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E;
        
        // Initialize TokenMessenger addresses - CORRECTED!
        tokenMessengerAddresses["ethereum"] = 0xBd3fa81B58Ba92a82136038B25aDec7066af3155;
        tokenMessengerAddresses["base"] = 0x1682ECb25F63946A1cA6dEe2Ef27bAE8bE4F0eCb;
        tokenMessengerAddresses["arbitrum"] = 0x19330d10D9Cc8751218eaf51E8885D058642E08A;
        tokenMessengerAddresses["op"] = 0x2B4069517957735bE00ceE0fadAE88a26365528f;
        tokenMessengerAddresses["polygon"] = 0x9daF8c91AEFAE50b9c0E69629D3F6Ca40cA3B3FE;
        tokenMessengerAddresses["avalanche"] = 0x6B25532e1060CE10cc3B0A99e5683b91BFDe6982;
    }
    
    function payUSDCToHandle(
        string memory platform,
        string memory username,
        uint256 amount,
        string memory sourceChain,
        string memory destinationChain
    ) external returns (bytes32) {
        // Resolve handle to wallet using existing registry
        (uint256 id, address recipient, , bool isActive) = registry.getMemberByHandle(platform, username);
        require(id != 0, "Handle not found");
        require(isActive, "Member not active");
        
        // Get CCTP configuration
        uint32 destinationDomain = chainToDomain[destinationChain];
        require(destinationDomain != 0 || keccak256(bytes(destinationChain)) == keccak256(bytes("ethereum")), "Unsupported destination chain");
        
        address sourceUSDC = chainToUSDC[sourceChain];
        require(sourceUSDC != address(0), "Unsupported source chain");
        
        address tokenMessengerAddr = tokenMessengerAddresses[sourceChain];
        require(tokenMessengerAddr != address(0), "TokenMessenger not configured for source chain");
        
        // Transfer USDC from sender to this contract
        IERC20 usdc = IERC20(sourceUSDC);
        require(usdc.transferFrom(msg.sender, address(this), amount), "USDC transfer failed");
        
        // Approve TokenMessenger
        require(usdc.approve(tokenMessengerAddr, amount), "USDC approval failed");
        
        // Convert recipient address to bytes32
        bytes32 mintRecipient = bytes32(uint256(uint160(recipient)));
        
        // Initiate cross-chain transfer via CCTP
        ITokenMessenger messenger = ITokenMessenger(tokenMessengerAddr);
        uint64 nonce = messenger.depositForBurn(amount, destinationDomain, mintRecipient, sourceUSDC);
        
        // Create a pseudo burn tx hash for tracking
        bytes32 burnTxHash = keccak256(abi.encodePacked(block.number, block.timestamp, nonce, msg.sender));
        
        emit USDCPaymentInitiated(
            platform,
            username,
            msg.sender,
            recipient,
            amount,
            sourceChain,
            destinationChain,
            burnTxHash
        );
        
        return burnTxHash;
    }
    
    // Admin functions to update CCTP configuration
    function updateChainDomain(string memory chain, uint32 domain) external onlyOwner {
        chainToDomain[chain] = domain;
    }
    
    function updateChainUSDC(string memory chain, address usdcAddress) external onlyOwner {
        chainToUSDC[chain] = usdcAddress;
    }
    
    function updateTokenMessenger(string memory chain, address tokenMessengerAddr) external onlyOwner {
        tokenMessengerAddresses[chain] = tokenMessengerAddr;
    }
}