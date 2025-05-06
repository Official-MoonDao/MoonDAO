// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

interface SmartWalletChecker {
    function check(address) external view returns (bool);
}

contract SmartWalletWhitelist {

    mapping(address => bool) public wallets;
    address public operator;
    address public checker;
    address public future_checker;

    event ApproveWallet(address);
    event RevokeWallet(address);

    constructor(address _operator) {
        operator = _operator;
        wallets[0xb1d4c1B9c8DA3191Fdb515Fa7AdeC3D41D014F4f] = true;
    }

    function commitSetChecker(address _checker) external {
        require(msg.sender == operator, "!operator");
        future_checker = _checker;
    }

    function applySetChecker() external {
        require(msg.sender == operator, "!operator");
        checker = future_checker;
    }

    function approveWallet(address _wallet) public {
        require(msg.sender == operator, "!operator");
        wallets[_wallet] = true;

        emit ApproveWallet(_wallet);
    }
    function revokeWallet(address _wallet) external {
        require(msg.sender == operator, "!operator");
        wallets[_wallet] = false;

        emit RevokeWallet(_wallet);
    }

    function check(address _wallet) external view returns (bool) {
        bool _check = wallets[_wallet];
        if (_check) {
            return _check;
        } else {
            if (checker != address(0)) {
                return SmartWalletChecker(checker).check(_wallet);
            }
        }
        return false;
    }

}