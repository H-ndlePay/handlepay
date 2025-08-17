// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {OApp, Origin, MessagingFee, MessagingReceipt} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import {OptionsBuilder} from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OptionsBuilder.sol";

contract PayStation is OApp {
    using OptionsBuilder for bytes;

    event PaymentRequested(address indexed payer, uint256 amount, uint32 dstEid, address receiver);
    event Ack(bytes32 guid, uint32 srcEid, address payer, uint256 amount);

    constructor(address endpoint) OApp(endpoint, msg.sender) {}

    // LZ v2 receive hook — MUST match base signature
    function _lzReceive(
        Origin calldata _origin,
        bytes32 _guid,
        bytes calldata _payload,
        address /* _executor */,
        bytes calldata /* _extraData */
    ) internal override {
        (address payer, , uint256 amount) =
            abi.decode(_payload, (address, address, uint256));
        // handle business logic (e.g., mark invoice paid)
    }

    // Example: request a payment on another chain
    function requestPayment(
        uint32 dstEid,
        address receiverOnDst,
        uint256 amountWei
    ) external payable returns (bytes32 guid) {
        bytes memory payload = abi.encode(msg.sender, receiverOnDst, amountWei);
        bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(200_000, 0);

        MessagingFee memory fee = _quote(dstEid, payload, options, false);
        require(msg.value >= fee.nativeFee, "fee too low");

        MessagingReceipt memory receipt =
            _lzSend(dstEid, payload, options, fee, payable(msg.sender));
        guid = receipt.guid;

        emit PaymentRequested(msg.sender, amountWei, dstEid, receiverOnDst);
    }
}
