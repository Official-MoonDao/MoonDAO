// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/console.sol";
import {PositionManager} from "v4-periphery/src/PositionManager.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {CurrencyLibrary, Currency} from "v4-core/src/types/Currency.sol";
import {Actions} from "v4-periphery/src/libraries/Actions.sol";
import {LiquidityAmounts} from "v4-core/test/utils/LiquidityAmounts.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";

interface IAllowanceTransfer {
    function approve(
        address token,
        address spender,
        uint160 amount,
        uint48 expiry
    ) external;
}

contract PoolDeployer {
    using CurrencyLibrary for Currency;
    IAllowanceTransfer constant PERMIT2 = IAllowanceTransfer(address(0x000000000022D473030F116dDEE9F6B43aC78BA3));
    mapping(uint256 => address) public POSITION_MANAGERS;
    uint256 MAINNET = 1;
    uint256 ARBITRUM = 42161;
    uint256 BASE = 8453;
    uint256 ARB_SEP = 421614;
    uint256 SEP = 11155111;

    PositionManager public posm;
    IERC20 public token;
    // FIXME don't hardcode
    //address public hookAddress = address(0x3AA84C1124d83be2BdD5ab193E3F0A84946A8844);
    address public hookAddress;

    // the startingPrice is expressed as sqrtPriceX96: floor(sqrt(token / token0) * 2^96)
    // use 1000:1 as starting price based on jb price of 0.001 per token
    //uint160 public startingPrice = 2505414483750479251915866636288;
    uint160 startingPrice = 79228162514264337593543950336; // floor(sqrt(1) * 2^96)

    // set tickLower and tickUpper to give liquidity at all prices

    constructor(address _hookAddress, address _positionManager) {
        hookAddress = _hookAddress;
        //POSITION_MANAGERS[MAINNET] = 0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e;
        //POSITION_MANAGERS[ARBITRUM] = 0xd88F38F930b7952f2DB2432Cb002E7abbF3dD869;
        //POSITION_MANAGERS[BASE] = 0x7C5f5A4bBd8fD63184577525326123B519429bDc;
        //POSITION_MANAGERS[ARB_SEP] = 0xAc631556d3d4019C95769033B5E719dD77124BAc;
        //POSITION_MANAGERS[SEP] = 0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4;
        //posm = PositionManager(payable(POSITION_MANAGERS[block.chainid]));
        posm = PositionManager(payable(_positionManager));
    }

    // Allow contract to receive ETH
    receive() external payable {}

    function setToken(address _token) external {
        require(address(token) == address(0), "Token already set");
        token = IERC20(_token);
    }

    function setHookAddress(address _hookAddress) external {
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
