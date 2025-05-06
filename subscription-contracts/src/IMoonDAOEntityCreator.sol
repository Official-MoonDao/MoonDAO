// SPDX-License-Identifier: MIT

pragma solidity ^0.8.13;

interface IMoonDAOEntityCreator {

    function createMoonDAOEntity(string calldata metaDataUri, string calldata hatsUri, address _table)
        external
        payable returns (uint256, uint256);
}
