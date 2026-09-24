// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {MoonDAOTeam} from "./ERC5643.sol";

/**
 * @title TeamMinterRouter
 * @notice `MoonDAOTeam.mintTo` is restricted to a single `moonDaoCreator` address. To let
 *         several creators (the hats-free team creator and the project creator) mint teams,
 *         this router is set as the sole `moonDaoCreator` and forwards mint calls from any
 *         authorized minter.
 */
contract TeamMinterRouter is Ownable {
    MoonDAOTeam public moonDAOTeam;

    mapping(address => bool) public minters;

    event MinterSet(address indexed minter, bool enabled);

    constructor(address _moonDAOTeam) Ownable(msg.sender) {
        moonDAOTeam = MoonDAOTeam(_moonDAOTeam);
    }

    function setMoonDAOTeam(address _moonDAOTeam) external onlyOwner {
        moonDAOTeam = MoonDAOTeam(_moonDAOTeam);
    }

    function setMinter(address minter, bool enabled) external onlyOwner {
        minters[minter] = enabled;
        emit MinterSet(minter, enabled);
    }

    function mintTo(
        address to,
        address sender,
        uint256 adminHat,
        uint256 managerHat,
        uint256 memberHat,
        address memberPassthroughModule,
        address splitContract
    ) external payable returns (uint256) {
        require(minters[msg.sender], "Only authorized minter");
        return
            moonDAOTeam.mintTo{value: msg.value}(
                to,
                sender,
                adminHat,
                managerHat,
                memberHat,
                memberPassthroughModule,
                splitContract
            );
    }
}
