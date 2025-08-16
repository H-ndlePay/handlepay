// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {OApp, Origin, MessagingFee} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import {OAppOptionsType3} from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OAppOptionsType3.sol";
import {OptionsBuilder} from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OptionsBuilder.sol";

// NOTE: Do NOT import Ownable here. OApp already inherits it.

contract OAppPing is OApp, OAppOptionsType3 {
    using OptionsBuilder for bytes;

    event PingReceived(uint32 indexed srcEid, uint256 count);

    mapping(uint32 => uint256) public lastCountFrom; // srcEid => last count

    // ✅ Pass args to the base OApp constructor (which wires Ownable(initialOwner) too)
    constructor(address _endpoint, address _owner)
        OApp(_endpoint, _owner)
    {}

    // Quote the native fee for sending `count`
    function quote(
        uint32 dstEid,
        uint256 count,
        bytes calldata options,
        bool payInZRO
    ) external view returns (MessagingFee memory) {
        bytes memory payload = abi.encode(count);
        return _quote(dstEid, payload, combineOptions(dstEid, 0, options), payInZRO);
    }

    // Send a ping (just a counter) to dst chain
    function send(
        uint32 dstEid,
        uint256 count,
        bytes calldata options
    ) external payable {
        bytes memory payload = abi.encode(count);
        _lzSend(
            dstEid,
            payload,
            combineOptions(dstEid, 0, options),
            MessagingFee(msg.value, 0),
            payable(msg.sender)
        );
    }

    // Handle incoming ping
    function _lzReceive(
        Origin calldata _origin,
        bytes32 /* _guid */,
        bytes calldata _message,
        address /* _executor */,
        bytes calldata /* _extra */
    ) internal override {
        uint256 count = abi.decode(_message, (uint256));
        lastCountFrom[_origin.srcEid] = count;
        emit PingReceived(_origin.srcEid, count);
    }
}
