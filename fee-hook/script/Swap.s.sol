// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {Actions} from "v4-periphery/src/libraries/Actions.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
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

    uint256 constant V4_SWAP = 0x10;

    function run() external {
        PoolKey memory poolKey = PoolKey({
            currency0: CurrencyLibrary.ADDRESS_ZERO,
            currency1: Currency.wrap(TEST_TOKEN_ADDRESSES[block.chainid]),
            fee: LP_FEE[block.chainid],
            tickSpacing: tickSpacing,
            hooks: IHooks(FEE_HOOK_ADDRESSES[block.chainid])
        });
        address routerAddress;
        UniversalRouter router = UniversalRouter(payable(V4_ROUTERS[block.chainid]));

        uint128 amountSpecified = 1e14;
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
