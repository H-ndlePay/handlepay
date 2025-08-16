// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

import { OApp, Origin, MessagingFee } from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import { OAppOptionsType3 } from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OAppOptionsType3.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MyOApp - Custom LayerZero Cross-Chain Application
 * @notice This contract demonstrates basic cross-chain messaging using LayerZero V2
 * @dev Inherits from OApp for core cross-chain functionality
 */
contract MyOApp is OApp, OAppOptionsType3 {
    
    // ══════════════════════════════════════════════════════════════════════════════
    // STATE VARIABLES
    // ══════════════════════════════════════════════════════════════════════════════
    
    /// @notice Last string received from any remote chain
    string public lastMessage;
    
    /// @notice Counter for messages sent from this chain
    uint256 public messagesSent;
    
    /// @notice Counter for messages received on this chain
    uint256 public messagesReceived;
    
    /// @notice Mapping to track messages received from each chain
    mapping(uint32 => uint256) public messagesFromChain;
    
    /// @notice Msg type for sending a string, for use in OAppOptionsType3 as an enforced option
    uint16 public constant SEND = 1;
    
    // ══════════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ══════════════════════════════════════════════════════════════════════════════
    
    /// @notice Emitted when a message is sent to another chain
    event MessageSent(uint32 indexed dstEid, string message, uint256 messageId);
    
    /// @notice Emitted when a message is received from another chain
    event MessageReceived(uint32 indexed srcEid, string message, uint256 totalReceived);
    
    // ══════════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ══════════════════════════════════════════════════════════════════════════════
    
    /// @notice Initialize with Endpoint V2 and owner address
    /// @param _endpoint The local chain's LayerZero Endpoint V2 address
    /// @param _owner The address permitted to configure this OApp
    constructor(address _endpoint, address _owner) 
        OApp(_endpoint, _owner) 
        Ownable(_owner) 
    {}
    
    // ══════════════════════════════════════════════════════════════════════════════
    // QUOTE FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════════════
    
    /**
     * @notice Quotes the gas needed to pay for the full omnichain transaction in native gas or ZRO token.
     * @param _dstEid Destination chain's endpoint ID.
     * @param _string The string to send.
     * @param _options Message execution options (e.g., for sending gas to destination).
     * @param _payInLzToken Whether to return fee in ZRO token.
     * @return fee A `MessagingFee` struct containing the calculated gas fee in either the native token or ZRO token.
     */
    function quoteSendString(
        uint32 _dstEid,
        string calldata _string,
        bytes calldata _options,
        bool _payInLzToken
    ) public view returns (MessagingFee memory fee) {
        bytes memory _message = abi.encode(_string);
        // combineOptions (from OAppOptionsType3) merges enforced options set by the contract owner
        // with any additional execution options provided by the caller
        fee = _quote(_dstEid, _message, combineOptions(_dstEid, SEND, _options), _payInLzToken);
    }
    
    // ══════════════════════════════════════════════════════════════════════════════
    // SEND FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════════════
    
    /// @notice Send a string to a remote OApp on another chain
    /// @param _dstEid Destination Endpoint ID (uint32)
    /// @param _string The string to send
    /// @param _options Execution options for gas on the destination (bytes)
    function sendString(
        uint32 _dstEid, 
        string calldata _string, 
        bytes calldata _options
    ) external payable {
        // 1. Update local state - increment message counter
        messagesSent++;
        uint256 currentMessageId = messagesSent;
        
        // 2. Encode the data structures you wish to send into bytes
        bytes memory _message = abi.encode(_string);
        
        // 3. Call OAppSender._lzSend to package and dispatch the cross-chain message
        _lzSend(
            _dstEid,
            _message,
            combineOptions(_dstEid, SEND, _options),
            MessagingFee(msg.value, 0),
            payable(msg.sender)
        );
        
        // 4. Emit event for tracking
        emit MessageSent(_dstEid, _string, currentMessageId);
    }
    
    /// @notice Convenience function to send a simple "Hello" message
    /// @param _dstEid Destination chain endpoint ID
    function sendHello(uint32 _dstEid) external payable {
        string memory message = string(abi.encodePacked("Hello from chain ", uint2str(block.chainid), "!"));
        
        // Use empty options for default settings
        bytes memory _options = "";
        
        this.sendString{value: msg.value}(_dstEid, message, _options);
    }
    
    // ══════════════════════════════════════════════════════════════════════════════
    // RECEIVE FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════════════
    
    /// @notice Invoked by OAppReceiver when EndpointV2.lzReceive is called
    /// @param _origin Metadata (source chain, sender address, nonce)
    /// @param _guid Global unique ID for tracking this message
    /// @param _message ABI-encoded bytes (the string we sent earlier)
    /// @param _executor Executor address that delivered the message
    /// @param _extraData Additional data from the Executor (unused here)
    function _lzReceive(
        Origin calldata _origin,
        bytes32 _guid,
        bytes calldata _message,
        address _executor,
        bytes calldata _extraData
    ) internal override {
        // 1. Decode the incoming bytes into a string
        string memory receivedString = abi.decode(_message, (string));
        
        // 2. Update state
        lastMessage = receivedString;
        messagesReceived++;
        messagesFromChain[_origin.srcEid]++;
        
        // 3. Emit event for tracking
        emit MessageReceived(_origin.srcEid, receivedString, messagesReceived);
    }
    
    // ══════════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════════════
    
    /// @notice Get the total number of messages received from a specific chain
    /// @param _srcEid Source chain endpoint ID
    /// @return Number of messages received from that chain
    function getMessagesFromChain(uint32 _srcEid) external view returns (uint256) {
        return messagesFromChain[_srcEid];
    }
    
    /// @notice Get contract statistics
    /// @return sent Total messages sent
    /// @return received Total messages received
    /// @return lastMsg Last message received
    function getStats() external view returns (uint256 sent, uint256 received, string memory lastMsg) {
        return (messagesSent, messagesReceived, lastMessage);
    }
    
    // ══════════════════════════════════════════════════════════════════════════════
    // UTILITY FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════════════
    
    /// @notice Convert uint to string
    /// @param _i The uint to convert
    /// @return The string representation
    function uint2str(uint256 _i) internal pure returns (string memory) {
        if (_i == 0) {
            return "0";
        }
        uint256 j = _i;
        uint256 len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint256 k = len;
        while (_i != 0) {
            k = k - 1;
            uint8 temp = (48 + uint8(_i - _i / 10 * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        return string(bstr);
    }
}