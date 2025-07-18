// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {PositionManager} from "v4-periphery/src/PositionManager.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {CurrencyLibrary, Currency} from "v4-core/src/types/Currency.sol";
import {Actions} from "v4-periphery/src/libraries/Actions.sol";
import {LiquidityAmounts} from "v4-core/test/utils/LiquidityAmounts.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IAllowanceTransfer {
    function approve(
        address token,
        address spender,
        uint160 amount,
        uint48 expiry
    ) external;
}

contract PoolDeployer is Ownable {
    using CurrencyLibrary for Currency;
    IAllowanceTransfer constant PERMIT2 = IAllowanceTransfer(address(0x000000000022D473030F116dDEE9F6B43aC78BA3));

    PositionManager public posm;
    IERC20 public token;
    address public hookAddress;

    // the startingPrice is expressed as sqrtPriceX96: floor(sqrt(token / token0) * 2^96)
    // use 1000:1 as starting price based on jb price of 0.001 per token
    uint160 public startingPrice = 2505414483750479251915866636288;

    // set tickLower and tickUpper to give liquidity at all prices

    constructor(address _hookAddress, address _positionManager, address owner) Ownable(owner) {
        hookAddress = _hookAddress;
        posm = PositionManager(payable(_positionManager));
    }

    // Allow contract to receive ETH
    receive() external payable {}

    function setToken(address _token) external {
        require(address(token) == address(0), "Token already set");
        token = IERC20(_token);
    }

    function setHookAddress(address _hookAddress) external onlyOwner {
        hookAddress = _hookAddress;
    }

    function createAndAddLiquidity() external {
        uint256 amount0 = address(this).balance - 1 wei;
        uint256 amount1 = token.balanceOf(address(this)) - 1 wei;
        require(amount0 > 0 && amount1 > 0, "no funds to deploy");

        // approvals for PERMIT2 & PositionManager
        token.approve(address(PERMIT2), type(uint256).max);
        PERMIT2.approve(address(token), address(posm), type(uint160).max, type(uint48).max);

        int24 tickSpacing = 100;
        int24 tickLower = TickMath.minUsableTick(tickSpacing);
        int24 tickUpper = TickMath.maxUsableTick(tickSpacing);
        uint128 liquidity = LiquidityAmounts.getLiquidityForAmounts(
            startingPrice,
            TickMath.getSqrtPriceAtTick(tickLower),
            TickMath.getSqrtPriceAtTick(tickUpper),
            amount0,
            amount1
        );

        uint256 amount0Max = amount0 + 1 wei;
        uint256 amount1Max = amount1 + 1 wei;


        PoolKey memory poolKey = PoolKey({
            currency0: CurrencyLibrary.ADDRESS_ZERO,
            currency1: Currency.wrap(address(token)),
            fee: 10000, // 1% fee
            tickSpacing: tickSpacing,
            hooks: IHooks(hookAddress)
        });

        (bytes memory actions, bytes[] memory mintParams) = _mintLiquidityParams(
            poolKey,
            tickLower,
            tickUpper,
            liquidity,
            amount0Max,
            amount1Max,
            hookAddress,
            ""
        );

        bytes[] memory params = new bytes[](2);
        params[0] = abi.encodeWithSelector(posm.initializePool.selector, poolKey, startingPrice, "");
        params[1] = abi.encodeWithSelector(
          posm.modifyLiquidities.selector,
          abi.encode(actions, mintParams),
          block.timestamp + 60
        );
        posm.multicall{value: amount0Max}(params);
    }

    function _mintLiquidityParams(
      PoolKey memory poolKey,
      int24 _tickLower,
      int24 _tickUpper,
      uint256 liquidity,
      uint256 amount0Max,
      uint256 amount1Max,
      address recipient,
      bytes memory hookData
    ) internal pure returns (bytes memory, bytes[] memory) {
        bytes memory actions = abi.encodePacked(uint8(Actions.MINT_POSITION), uint8(Actions.SETTLE_PAIR));
        bytes[] memory params = new bytes[](2);
        params[0] = abi.encode(poolKey, _tickLower, _tickUpper, liquidity, amount0Max, amount1Max, recipient, hookData);
        params[1] = abi.encode(poolKey.currency0, poolKey.currency1);
        return (actions, params);
    }
}
