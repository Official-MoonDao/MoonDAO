// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {Actions} from "v4-periphery/src/libraries/Actions.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolSwapTest} from "v4-core/src/test/PoolSwapTest.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";
import {CurrencyLibrary, Currency} from "v4-core/src/types/Currency.sol";
import { IV4Router } from "v4-periphery/src/interfaces/IV4Router.sol";
import { UniversalRouter } from "@uniswap/universal-router/contracts/UniversalRouter.sol";

import {Constants} from "./base/Constants.sol";
import {Config} from "./base/Config.sol";

contract SwapScript is Script, Constants, Config {
    // slippage tolerance to allow for unlimited price impact
    uint160 public constant MIN_PRICE_LIMIT = TickMath.MIN_SQRT_PRICE + 1;
    uint160 public constant MAX_PRICE_LIMIT = TickMath.MAX_SQRT_PRICE - 1;

    /////////////////////////////////////
    // --- Parameters to Configure --- //
    /////////////////////////////////////

    // PoolSwapTest Contract address, default to the anvil address
    uint256 constant V4_SWAP = 0x10;
    PoolSwapTest swapRouter = PoolSwapTest(0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9);

    // --- pool configuration --- //
    // fees paid by swappers that accrue to liquidity providers

    function run() external {
        PoolKey memory poolKey = PoolKey({
            currency0: currency0,
            currency1: getCurrency1(),
            fee: lpFee,
            tickSpacing: tickSpacing,
            hooks: getHook()
        });
        address routerAddress;
        if(block.chainid == 1) { //mainnet
            routerAddress = 0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af;
        } else if (block.chainid == 42161) { //arbitrum
            routerAddress = 0xA51afAFe0263b40EdaEf0Df8781eA9aa03E381a3;
        } else if (block.chainid == 8453) { //base
            routerAddress = 0x6fF5693b99212Da76ad316178A184AB56D299b43;
        } else if (block.chainid == 421614) { //arb-sep
            routerAddress = 0xeFd1D4bD4cf1e86Da286BB4CB1B8BcED9C10BA47;
        } else if (block.chainid == 11155111) { //sep
            routerAddress = 0x3A9D48AB9751398BbFa63ad67599Bb04e4BdF98b;
        }
        UniversalRouter router = UniversalRouter(payable(routerAddress));

        uint128 amountSpecified = 1e16;
        bytes memory commands = abi.encodePacked(uint8(V4_SWAP));
        bytes memory actions = abi.encodePacked(
           uint8(Actions.SWAP_EXACT_IN_SINGLE),
           uint8(Actions.SETTLE_ALL),
           uint8(Actions.TAKE_ALL)
        );
        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(
            IV4Router.ExactInputSingleParams({
                poolKey: poolKey,
                zeroForOne: true,            // true if we're swapping token0 for token1
                amountIn: amountSpecified,          // amount of tokens we're swapping
                amountOutMinimum: 0, // minimum amount we expect to receive
                hookData: bytes("")             // no hook data needed
            })
        );
        params[1] = abi.encode(poolKey.currency0, amountSpecified);
        params[2] = abi.encode(poolKey.currency1, 0);
        bytes[] memory inputs = new bytes[](1);

        inputs[0] = abi.encode(actions, params);

        uint256 deadline = block.timestamp + 80;

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);
        router.execute{value: amountSpecified}(commands, inputs, deadline);

        vm.stopBroadcast();
    }
}
