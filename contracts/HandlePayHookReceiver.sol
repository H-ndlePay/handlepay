// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IMessageTransmitterV2 {
  function receiveMessage(bytes calldata message, bytes calldata attestation) external returns (bool);
}

/**
 * Set this contract as `destinationCaller` (bytes32) in TokenMessengerV2.depositForBurnWithHook.
 * It completes the mint on the destination and emits an app-specific event your subgraph can index.
 *
 * Suggested hookData schema (for your sender task to encode):
 *   abi.encode(string tag, string platform, string username, uint256 amount6)
 *   e.g. ("HPAY", "twitter", "dhanrajkotian12", 2_000_000)
 */
contract HandlePayHookReceiver {
  address public immutable messageTransmitterV2;

  event USDCHandlePayment(
    uint32 sourceDomain,
    uint32 destinationDomain,
    address sender,        // depositor on source chain
    address recipient,     // mintRecipient on destination
    address burnToken,
    uint256 amount,        // minted amount (USDC has 6 decimals)
    string platform,       // parsed from hookData (best-effort)
    string username,       // parsed from hookData (best-effort)
    bytes hookData,        // raw hookData for auditing
    bytes32 nonce
  );

  constructor(address _mtv2) {
    messageTransmitterV2 = _mtv2;
  }

  function mintAndLog(bytes calldata message, bytes calldata attestation) external {
    // Completes the CCTP v2 mint. Reverts unless this contract == destinationCaller in `message`.
    IMessageTransmitterV2(messageTransmitterV2).receiveMessage(message, attestation);

    // Decode CCTP v2 message header
    (
      uint32 version,
      uint32 srcDomain,
      uint32 dstDomain,
      bytes32 nonce,
      bytes32 messageSenderB32,
      bytes32 mintRecipientB32,
      /* bytes32 destCaller */,
      /* uint32  minFinality */,
      /* uint32  finalityExecuted */,
      bytes memory body
    ) = abi.decode(
      message,
      (uint32,uint32,uint32,bytes32,bytes32,bytes32,bytes32,uint32,uint32,bytes)
    );
    require(version == 1, "Not CCTP v2");

    // Decode BurnMessageV2 body (includes hookData)
    (
      uint32 burnMsgVersion,
      bytes32 burnTokenB32,
      bytes32 mintRecipientAgainB32,
      uint256 amount,
      /* bytes32 messageSenderAgainB32 */,
      /* uint256 maxFee */,
      /* uint256 feeExecuted */,
      /* uint256 expirationBlock */,
      bytes memory hookData
    ) = abi.decode(
      body,
      (uint32,bytes32,bytes32,uint256,bytes32,uint256,uint256,uint256,bytes)
    );
    require(burnMsgVersion == 1, "Not burn v2");
    require(mintRecipientAgainB32 == mintRecipientB32, "recipient mismatch");
    // Best-effort parse of our suggested hook schema.
    // Use an external self-call so we can try/catch decode failures.
    (string memory platform, string memory username) = ("", "");
    if (hookData.length >= 4) {
      try this._decodeHook(hookData) returns (string memory _platform, string memory _username) {
        platform = _platform;
        username = _username;
      } catch {
        // ignore: keep empty strings if hookData doesn't match our schema
      }
    }

    emit USDCHandlePayment(
      srcDomain,
      dstDomain,
      _toAddr(messageSenderB32),
      _toAddr(mintRecipientB32),     // same as mintRecipientAgainB32
      _toAddr(burnTokenB32),
      amount,
      platform,
      username,
      hookData,
      nonce
    );
  }

  // Helper used only to allow try/catch around abi.decode
  function _decodeHook(bytes calldata data)
    external
    pure
    returns (string memory platform, string memory username)
  {
    // decode and return the platform & username
    (/* string tag */, platform, username, /* uint256 amount6 */) =
      abi.decode(data, (string,string,string,uint256));
  }

  function _toAddr(bytes32 b) internal pure returns (address) {
    return address(uint160(uint256(b)));
  }
}
