// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract HandleRegistry is Ownable {
    struct Member {
        uint256 id;
        address wallet;
        uint256 joinedBlock;
        bool isActive;
    }
    
    mapping(uint256 => Member) public members;
    mapping(bytes32 => uint256) public handleToMemberId;
    mapping(address => uint256) public walletToMemberId;
    mapping(uint256 => bytes32[]) public memberHandles;
    
    uint256 public nextMemberId = 1;
    uint256 public totalActiveMembers = 0;
    
    address public constant USDC_BASE = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    
    event MemberCreated(uint256 indexed memberId, address wallet);
    event HandleAdded(uint256 indexed memberId, string platform, string username);
    event PaymentSent(string platform, string username, address from, uint256 amount);
    
    constructor(address _owner) Ownable(_owner) {}
    
    function createMember(address wallet) external onlyOwner returns (uint256) {
        require(walletToMemberId[wallet] == 0, "Wallet already assigned");
        
        uint256 memberId = nextMemberId++;
        
        members[memberId] = Member({
            id: memberId,
            wallet: wallet,
            joinedBlock: block.number,
            isActive: true
        });
        
        walletToMemberId[wallet] = memberId;
        totalActiveMembers++;
        
        emit MemberCreated(memberId, wallet);
        return memberId;
    }
    
    function addHandle(
        uint256 memberId,
        string memory platform,
        string memory username
    ) external onlyOwner {
        require(members[memberId].isActive, "Member not active");
        
        bytes32 handleKey = keccak256(abi.encodePacked(platform, ":", username));
        require(handleToMemberId[handleKey] == 0, "Handle already taken");
        
        handleToMemberId[handleKey] = memberId;
        memberHandles[memberId].push(handleKey);
        
        emit HandleAdded(memberId, platform, username);
    }
    
    function payToHandle(
        string memory platform,
        string memory username
    ) external payable {
        bytes32 handleKey = keccak256(abi.encodePacked(platform, ":", username));
        uint256 memberId = handleToMemberId[handleKey];
        require(memberId != 0, "Handle not found");
        require(members[memberId].isActive, "Member not active");
        
        address recipient = members[memberId].wallet;
        (bool success, ) = payable(recipient).call{value: msg.value}("");
        require(success, "Payment failed");
        
        emit PaymentSent(platform, username, msg.sender, msg.value);
    }
    
    function getMemberByHandle(
        string memory platform,
        string memory username
    ) external view returns (Member memory) {
        bytes32 handleKey = keccak256(abi.encodePacked(platform, ":", username));
        uint256 memberId = handleToMemberId[handleKey];
        require(memberId != 0, "Handle not found");
        return members[memberId];
    }
}
