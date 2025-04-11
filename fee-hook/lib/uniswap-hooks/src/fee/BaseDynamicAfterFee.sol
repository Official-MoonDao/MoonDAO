// SPDX-License-Identifier: MIT
// OpenZeppelin Uniswap Hooks (last updated v0.1.0) (src/fee/BaseDynamicAfterFee.sol)

pragma solidity ^0.8.24;

import {BaseHook} from "src/base/BaseHook.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {PoolId} from "v4-core/src/types/PoolId.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";

/**
 * @dev Base implementation for dynamic fees applied after swaps.
 *
 * In order to use this hook, the inheriting contract must define a target delta for a swap before
 * the {afterSwap} function is called. This can be done accurately by using the {beforeSwap} hook
 * to define the target delta for the current swap according to arbitrary logic.
 *
 * IMPORTANT: This hook only supports exact-input swaps. For exact-output swaps, the hook will not apply
 * the target delta.
 *
 * WARNING: This is experimental software and is provided on an "as is" and "as available" basis. We do
 * not give any warranties and will not be liable for any losses incurred through any use of this code
 * base.
 *
 * _Available since v0.1.0_
 */
abstract contract BaseDynamicAfterFee is BaseHook {
    mapping(PoolId => BalanceDelta) internal _targetDeltas;

    /**
     * @dev Set the `PoolManager` address.
     */
    constructor(IPoolManager _poolManager) BaseHook(_poolManager) {}

    /**
     * @dev Calculate the target delta and apply the fee so that the returned delta matches.
     *
     * Target deltas are only applied for exact-input swaps that meet the minimum delta value
     * for either `amount0` or `amount1`.
     *
     * NOTE: The target delta is reset to 0 after the swap is processed, regardless of the
     * swap parameters. Therefore, it is recommended to use the {beforeSwap} hook to set the
     * target delta for swaps automatically.
     *
     * IMPORTANT: The fees obtained from netting with the target delta are donated to the pool and
     * distributed among in-range liquidity providers. Note that this donation mechanism can be
     * exploited by attackers who add just-in-time liquidity to a narrow range around the final
     * tick after the swap. Such liquidity would receive a disproportionate share of the donation
     * despite not meaningfully participating in the swap. Implementers should carefully consider
     * this possibility when using this default hook implementation.
     */
    function _afterSwap(
        address,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata
    ) internal virtual override returns (bytes4, int128) {
        int128 feeAmount = 0;

        // Only apply target delta for exact-input swaps
        if (params.amountSpecified < 0) {
            PoolId poolId = key.toId();
            BalanceDelta targetDelta = _targetDeltas[poolId];

            // Skip empty/undefined target delta
            if (BalanceDelta.unwrap(targetDelta) != 0) {
                // Reset storage target delta to 0 and use one stored in memory
                _targetDeltas[poolId] = BalanceDelta.wrap(0);

                // Apply target delta on token amount user would receive (amount1)
                if (params.zeroForOne && delta.amount1() > targetDelta.amount1()) {
                    feeAmount = delta.amount1() - targetDelta.amount1();

                    // feeAmount is positive and int128, so we can safely cast to uint128 given that uint128
                    // has a larger maximum value.
                    poolManager.donate(key, 0, uint256(uint128(feeAmount)), "");
                }

                // Apply target delta on token amount user would receive (amount0)
                if (!params.zeroForOne && delta.amount0() > targetDelta.amount0()) {
                    feeAmount = delta.amount0() - targetDelta.amount0();

                    // feeAmount is positive and int128, so we can safely cast to uint128 given that uint128
                    // has a larger maximum value.
                    poolManager.donate(key, uint256(uint128(feeAmount)), 0, "");
                }
            }
        }

        return (this.afterSwap.selector, feeAmount);
    }

    /**
     * @dev Set the hook permissions, specifically {afterSwap} and {afterSwapReturnDelta}.
     *
     * @return permissions The hook permissions.
     */
    function getHookPermissions() public pure virtual override returns (Hooks.Permissions memory permissions) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: false,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: true,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }
}
