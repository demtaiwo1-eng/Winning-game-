// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract EventEscrowVault {
    address public owner;
    uint256 public totalEscrowed;

    event EscrowDeposited(address indexed payer, uint256 amount);
    event EscrowReleased(address indexed payee, uint256 amount);
    event EscrowRefunded(address indexed payer, uint256 amount);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    function deposit() external payable {
        require(msg.value > 0, "zero value");
        totalEscrowed += msg.value;
        emit EscrowDeposited(msg.sender, msg.value);
    }

    function release(address payable recipient, uint256 amount) external onlyOwner {
        require(amount <= address(this).balance, "insufficient escrow");
        recipient.transfer(amount);
        totalEscrowed -= amount;
        emit EscrowReleased(recipient, amount);
    }

    function refund(address payable recipient, uint256 amount) external onlyOwner {
        require(amount <= address(this).balance, "insufficient escrow");
        recipient.transfer(amount);
        totalEscrowed -= amount;
        emit EscrowRefunded(recipient, amount);
    }

    receive() external payable {}
}
