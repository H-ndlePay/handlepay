// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {OApp, Origin, MessagingFee, MessagingReceipt} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import {OptionsBuilder} from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OptionsBuilder.sol";

contract Requester is OApp {
    using OptionsBuilder for bytes;

    event PaymentRequest(bytes32 indexed guid, address indexed recipient, uint256 amount, uint32 dstEid);
    event AckReceived(bytes32 indexed guid, address indexed recipient, uint256 amount);

    constructor(address _endpoint) OApp(_endpoint, msg.sender) {}

    function requestPayment(
        uint32 dstEid,
        address recipientOnDst,
        uint256 amountWei
    ) external payable returns (bytes32 guid) {
        bytes memory payload = abi.encode(msg.sender, recipientOnDst, amountWei);

        bytes memory options = OptionsBuilder
            .newOptions()
            .addExecutorLzReceiveOption(200_000, 0);

        MessagingFee memory fee = _quote(dstEid, payload, options, false);
        require(msg.value >= fee.nativeFee, "fee too low");

        MessagingReceipt memory receipt =
            _lzSend(dstEid, payload, options, fee, payable(msg.sender));
        guid = receipt.guid;

        emit PaymentRequest(guid, recipientOnDst, amountWei, dstEid);
    }

    function _lzReceive(
        Origin calldata /* origin */,
        bytes32 guid,
        bytes calldata payload,
        address /* executor */,
        bytes calldata /* extraData */
    ) internal override {
        (address recipient, uint256 amount) = abi.decode(payload, (address, uint256));
        emit AckReceived(guid, recipient, amount);
    }
}
