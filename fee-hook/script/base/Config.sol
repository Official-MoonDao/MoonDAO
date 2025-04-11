// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {CurrencyLibrary, Currency} from "v4-core/src/types/Currency.sol";

/// @notice Shared configuration between scripts
contract Config {

    Currency constant currency0 = CurrencyLibrary.ADDRESS_ZERO;
    //uint24 lpFee = 10000;
    // FIXME don't do 50% fee
    uint24 lpFee = 500000;
    int24 tickSpacing = 60;

    function getHookAddress() public view returns (address) {
        return getHookAddress(block.chainid);
    }

    function getHookAddress(uint256 chainId) public view returns (address) {
        address hookAddress;
        if(chainId == 1) { //mainnet
        } else if (chainId == 42161) { //arbitrum
        } else if (chainId == 8453) { //base
        } else if (chainId == 421614) { //arb-sep
            hookAddress = 0x049AA55919fCbfa37d1A220dCFF16b5fA9f60844;
        } else if (chainId == 11155111) { //sep
            hookAddress = 0x45A0AA93f6972AA137086002527B2ECc1D1b8844;
        }

        return hookAddress;
    }

    function getHook() public view returns (IHooks) {
        return IHooks(getHookAddress(block.chainid));
    }

    function getTokenAddress(uint256 chainId) public view returns (address) {
        address tokenAddress;
        if(chainId == 1) { //mainnet
        } else if (chainId == 42161) { //arbitrum
        } else if (chainId == 8453) { //base
        } else if (chainId == 421614) { //arb-sep
            tokenAddress = 0xcA9b92A7F9FDabC52CBAED5e81F096490D20deDe;
        } else if (chainId == 11155111) { //sep
            tokenAddress = 0x9B228F540f7245D7efd911043cC0315198CdDaf2;
        }

        return tokenAddress;
    }

    function getToken() public view returns (IERC20) {
        return IERC20(getTokenAddress(block.chainid));
    }

    function getCurrency1() public view returns (Currency) {
        return Currency.wrap(getTokenAddress(block.chainid));
    }
}
