// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import {Config} from "../script/base/Config.sol";
import {Constants} from "../script/base/Constants.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {FakeERC20} from "../src/FakeERC20.sol";
import {Actions} from "v4-periphery/src/libraries/Actions.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";
import {PoolId} from "v4-core/src/types/PoolId.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {ActionConstants} from "v4-periphery/src/libraries/ActionConstants.sol";
import {MockJBERC20} from "../src/MockJBERC20.sol";
import {Constants as UniswapConstants} from "v4-core/src/../test/utils/Constants.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";
import {CurrencyLibrary, Currency} from "v4-core/src/types/Currency.sol";
import { UniversalRouter } from "@uniswap/universal-router/contracts/UniversalRouter.sol";
import { IV4Router } from "v4-periphery/src/interfaces/IV4Router.sol";
import {FeeHook} from "../src/FeeHook.sol";
import {HookMiner} from "v4-periphery/src/utils/HookMiner.sol";
import {IPositionManager} from "v4-periphery/src/interfaces/IPositionManager.sol";
import {PositionManager} from "v4-periphery/src/PositionManager.sol";
import {StateLibrary} from "v4-core/src/libraries/StateLibrary.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {IWETH9} from "v4-periphery/src/interfaces/external/IWETH9.sol";

contract FeeHookTest is Test, Config, Constants {
    using StateLibrary for IPoolManager;
    // 1%
    uint24 constant FEE = 10000;
    uint24 constant FEE_DENOMINATOR = 1_000_000;
    uint256 constant V4_SWAP = 0x10;

    IPoolManager manager;
    address poolManagerAddress;
    IPositionManager posm;
    UniversalRouter router;
    address posmAddress;
    // Mainnet
    uint256 CHAIN = MAINNET;
    address lzEndpoint = LZ_ENDPOINTS[block.chainid];
    uint128 SWAP_AMOUNT = 1 ether;
    address fakeTokenAddress;
    FeeHook feeHook;

    address user1 = address(0x1);
    address user2 = address(0x3);
    address dead = address(0x000000000000000000000000000000000000dEaD);
    address deployerAddress = address(0x69420);
    uint256 DEPLOYER_FUNDS =100_000_000_000 ether;
    uint256 DEPLOYER_TOKEN_BALANCE = 100_000;

    function setUp() public {
        // v4 mainnet addresses
        poolManagerAddress = POOL_MANAGERS[block.chainid];
        manager = IPoolManager(poolManagerAddress);
        posmAddress = POSITION_MANAGERS[block.chainid];
        posm = IPositionManager(posmAddress);
        address payable routerAddress = payable(V4_ROUTERS[block.chainid]);
        router = UniversalRouter(routerAddress);
        vm.deal(address(manager), 100_000_000 ether);
        vm.deal(address(posm), 100_000_000 ether);
        vm.deal(deployerAddress, DEPLOYER_FUNDS);

        vm.startBroadcast(deployerAddress);
        FakeERC20 fakeToken = new FakeERC20(DEPLOYER_TOKEN_BALANCE * 1e18, "Fake Token", "FAKE", deployerAddress);
        fakeTokenAddress = address(fakeToken);
        vm.stopBroadcast();
    }

    function testFeeHook() public {
        vm.startBroadcast(deployerAddress);
        feeHook = deployHook();
        vm.stopBroadcast();
        skip(1 days);
        address hookAddress = address(feeHook);

        // test the lifecycle (create pool, add liquidity, swap)
        vm.startBroadcast(deployerAddress);
        testLifecycle(hookAddress);
        vm.stopBroadcast();
    }

    function deployHook() internal returns (FeeHook) {
        // hook contracts must have specific flags encoded in the address
        uint160 permissions = uint160(
            Hooks.AFTER_SWAP_FLAG | Hooks.BEFORE_ADD_LIQUIDITY_FLAG | Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG
        );

        // Mine a salt that will produce a hook address with the correct permissions
        (address hookAddress, bytes32 salt) =
            HookMiner.find(CREATE2_DEPLOYER, permissions, type(FeeHook).creationCode, abi.encode(deployerAddress, poolManagerAddress, posmAddress, fakeTokenAddress));

        feeHook = new FeeHook{salt: salt}(deployerAddress, IPoolManager(poolManagerAddress), IPositionManager(posmAddress), fakeTokenAddress);
        require(address(feeHook) == hookAddress, "FeeHookTest: hook address mismatch");
        return feeHook;
    }

    function deployToken(address recipient) internal returns (MockJBERC20 token1) {
        token1 = new MockJBERC20("Mock", "MOCK", 18);
        token1.mintTo(recipient, 100_000 ether);
        Currency currency = Currency.wrap(address(token1));
        // Because POSM uses permit2, we must execute 2 permits/approvals.
        // 1. First, the caller must approve permit2 on the token.
        IERC20(Currency.unwrap(currency)).approve(address(PERMIT2), type(uint256).max);
        // 2. Then, the caller must approve POSM as a spender of permit2
        PERMIT2.approve(Currency.unwrap(currency), address(posm), type(uint160).max, type(uint48).max);
        PERMIT2.approve(Currency.unwrap(currency), address(router), type(uint160).max, type(uint48).max);
    }

    function testLifecycle(address hookAddress) internal {
        MockJBERC20 token1 = deployToken(deployerAddress);

        // initialize the pool
        int24 tickSpacing = 60;
        PoolKey memory poolKey =
            PoolKey(CurrencyLibrary.ADDRESS_ZERO, Currency.wrap(address(token1)), FEE, tickSpacing, IHooks(hookAddress));
        manager.initialize(poolKey, UniswapConstants.SQRT_PRICE_1_1);

        // add full range liquidity to the pool
        int24 tickLower = TickMath.minUsableTick(tickSpacing);
        int24 tickUpper = TickMath.maxUsableTick(tickSpacing);
        mintLiquidity(poolKey, tickLower, tickUpper, deployerAddress);
        // transfer the position to the fee hook
        uint256 tokenId = feeHook.poolIdToTokenId(poolKey.toId());
        PositionManager(payable(posmAddress)).transferFrom(
            address(deployerAddress),
            address(feeHook),
            tokenId
        );

        uint256 tokenBalanceBefore = IERC20(Currency.unwrap(poolKey.currency1)).balanceOf(dead);
        // swap some tokens
        swapReverse(poolKey);
        swap(poolKey);

        uint256 tokenBalanceAfter = IERC20(Currency.unwrap(poolKey.currency1)).balanceOf(dead);

        // check that tokens are burnt, with some tolerance for rounding errors
        uint256 burntAmount = tokenBalanceAfter - tokenBalanceBefore;
        assertApproxEqAbs(burntAmount, SWAP_AMOUNT * FEE / FEE_DENOMINATOR, 1);


        // FIXME uncomment after local chainlink integration
        uint256 balanceBefore = address(deployerAddress).balance;
        uint256 withdrawableAmount = SWAP_AMOUNT * FEE / FEE_DENOMINATOR;
        feeHook.checkIn();
        skip(6 days);
        feeHook.distributeFees();
        uint256 balanceAfter = address(deployerAddress).balance;
        assertEq(balanceAfter - balanceBefore, withdrawableAmount);

        vm.expectRevert("Week not finished");
        feeHook.distributeFees();


        // transfer the position back to the deployer to allow closing the position
        feeHook.transferPosition(
            deployerAddress,
            tokenId
        );

        // burn the position
        burn(poolKey, tokenId);
        uint256 deployerTokenBalanceAfter = IERC20(Currency.unwrap(poolKey.currency1)).balanceOf(deployerAddress);
        uint256 balanceAfterBurn = address(deployerAddress).balance;
        assertApproxEqAbs(balanceAfterBurn, DEPLOYER_FUNDS, 8);
        assertApproxEqAbs(deployerTokenBalanceAfter, DEPLOYER_TOKEN_BALANCE * 1e18 - burntAmount, 4);
    }

    function burn(PoolKey memory poolKey, uint256 tokenId) internal {
        bytes memory actions = abi.encodePacked(uint8(Actions.BURN_POSITION), uint8(Actions.TAKE_PAIR));
        bytes[] memory params = new bytes[](2);
        params[0] = abi.encode(tokenId, 69420, 69420, "");
        params[1] = abi.encode(poolKey.currency0, poolKey.currency1, ActionConstants.MSG_SENDER);
        posm.modifyLiquidities(
            abi.encode(actions, params),
            block.timestamp + 30 days
        );
    }

    function mintLiquidity(PoolKey memory poolKey, int24 tickLower, int24 tickUpper, address hookAddress) internal returns (uint256){
        bytes memory actions = abi.encodePacked(uint8(Actions.MINT_POSITION), uint8(Actions.SETTLE_PAIR));
        bytes[] memory params = new bytes[](2);
        uint256 valueToPass = 100 ether;
        params[0] = abi.encode(poolKey, tickLower, tickUpper, valueToPass , 10_000e18, 10_000e18, hookAddress, bytes32(""));
        params[1] = abi.encode(poolKey.currency0, poolKey.currency1);
        posm.modifyLiquidities{value: valueToPass}(
            abi.encode(actions, params),
            block.timestamp + 300
        );

        return 0;
    }

    function testCheckInDuplicate() public {
        vm.startBroadcast(deployerAddress);
        feeHook = deployHook();
        FakeERC20 token = FakeERC20(fakeTokenAddress);
        token.transfer(user1, 10 ether);
        vm.stopBroadcast();

        vm.prank(user1);
        feeHook.checkIn();
        assertEq(feeHook.getCheckedInCount(), 1);

        vm.prank(user1);
        feeHook.checkIn();
        assertEq(feeHook.getCheckedInCount(), 1);
    }

    function testDistributeFeesNoCheckins() public {
        vm.startBroadcast(deployerAddress);
        feeHook = deployHook();
        vm.stopBroadcast();

        skip(8 days);
        vm.expectRevert("No checkins");
        feeHook.distributeFees();
    }

    function testDistributeFeesMultipleUsers() public {
        vm.startBroadcast(deployerAddress);
        feeHook = deployHook();
        FakeERC20 token = FakeERC20(fakeTokenAddress);
        token.transfer(user1, 10 ether);
        token.transfer(user2, 30 ether);
        vm.stopBroadcast();

        vm.prank(user1);
        feeHook.checkIn();
        vm.prank(user2);
        feeHook.checkIn();

        uint256 user1BalanceBefore = user1.balance;
        uint256 user2BalanceBefore = user2.balance;
        vm.deal(address(feeHook), 4 ether);
        skip(8 days);
        feeHook.distributeFees();

        assertEq(user1.balance - user1BalanceBefore, 1 ether);
        assertEq(user2.balance - user2BalanceBefore, 3 ether);
        assertEq(address(feeHook).balance, 0);
    }

    // trade eth for tokens
    function swap(PoolKey memory poolKey) internal {
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
               zeroForOne: true,
               amountIn: SWAP_AMOUNT,
               amountOutMinimum: 0,
               hookData: bytes("")
           })
       );
       params[1] = abi.encode(poolKey.currency0, SWAP_AMOUNT);
       params[2] = abi.encode(poolKey.currency1, 0);
       bytes[] memory inputs = new bytes[](1);

       inputs[0] = abi.encode(actions, params);

       uint256 deadline = block.timestamp + 20;
       router.execute{value: SWAP_AMOUNT}(commands, inputs, deadline);
    }

    // trade tokens for eth
    function swapReverse(PoolKey memory poolKey) internal {
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
               zeroForOne: false,
               amountIn: SWAP_AMOUNT,
               amountOutMinimum: 0,
               hookData: bytes("")
           })
       );
       params[1] = abi.encode(poolKey.currency1, SWAP_AMOUNT);
       params[2] = abi.encode(poolKey.currency0, 0);
       bytes[] memory inputs = new bytes[](1);

       inputs[0] = abi.encode(actions, params);

       uint256 deadline = block.timestamp + 20;
       router.execute(commands, inputs, deadline);
    }
}
