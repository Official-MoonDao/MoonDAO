// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/console.sol";
import "forge-std/Script.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
//import {Commands} from "@uniswap/universal-router/contracts/libraries/Commands.sol";
import { Commands } from "@uniswap/universal-router/contracts/libraries/Commands.sol";
import {PoolManager} from "v4-core/src/PoolManager.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {FakeERC20} from "../src/FakeERC20.sol";
import {Actions} from "v4-periphery/src/libraries/Actions.sol";
import {PoolModifyLiquidityTest} from "v4-core/src/test/PoolModifyLiquidityTest.sol";
import {PoolSwapTest} from "v4-core/src/test/PoolSwapTest.sol";
import {PoolDonateTest} from "v4-core/src/test/PoolDonateTest.sol";
import {PoolId} from "v4-core/src/types/PoolId.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";
import {Constants} from "v4-core/src/../test/utils/Constants.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";
import {CurrencyLibrary, Currency} from "v4-core/src/types/Currency.sol";

import { UniversalRouter } from "@uniswap/universal-router/contracts/UniversalRouter.sol";
import { IV4Router } from "v4-periphery/src/interfaces/IV4Router.sol";
import {FeeHook} from "../src/FeeHook.sol";
import {HookMiner} from "v4-periphery/src/utils/HookMiner.sol";
import {IPositionManager} from "v4-periphery/src/interfaces/IPositionManager.sol";
import {PositionManager} from "v4-periphery/src/PositionManager.sol";
//import {EasyPosm} from "../test/utils/EasyPosm.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";
import {StateLibrary} from "v4-core/src/libraries/StateLibrary.sol";
import {DeployPermit2} from "../test/utils/forks/DeployPermit2.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {IPositionDescriptor} from "v4-periphery/src/interfaces/IPositionDescriptor.sol";
import {IWETH9} from "v4-periphery/src/interfaces/external/IWETH9.sol";

/// @notice Forge script for deploying v4 & hooks to **anvil**
contract CounterScript is Script, DeployPermit2 {
    //using EasyPosm for IPositionManager;
    using StateLibrary for IPoolManager;
    uint24 constant FEE = 10000;
    uint256 constant V4_SWAP = 0x10;

    address constant CREATE2_DEPLOYER = address(0x4e59b44847b379578588920cA78FbF26c0B4956C);
    IPoolManager manager;
    address poolManagerAddress;
    IPositionManager posm;
    UniversalRouter router;
    address posmAddress;
    address payable routerAddress;
    address lzEndpoint = 0x1a44076050125825900e736c501f859c50fE728c;
    uint256 DESTINATION_CHAIN_ID = 1;
    uint16 DESTINATION_EID = 30101;
    PoolModifyLiquidityTest lpRouter;
    PoolSwapTest swapRouter;
    address fakeTokenAddress;
    address deployerAddress;
    FeeHook feeHook;

    function setUp() public {
        vm.deal(msg.sender, 100_000_000 ether);
        // mint some eth to the deployer
    }

    function run() public {
        uint256 deployerPrivateKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;

        deployerAddress = vm.addr(deployerPrivateKey);
        vm.startBroadcast(deployerPrivateKey);
        FakeERC20 fakeToken = new FakeERC20(100_000, "Fake Token", "FAKE");
        vm.stopBroadcast();
        console.log("Fake token address: ", address(fakeToken));
        console.log("Fake token supply: ", fakeToken.totalSupply());
        fakeTokenAddress = address(fakeToken);
        //vm.broadcast();
        vm.deal(deployerAddress, 100_000_000_000 ether);
        //manager = deployPoolManager();
        //poolManagerAddress = address(manager);
        poolManagerAddress = 0x000000000004444c5dc75cB358380D2e3dE08A90;
        manager = IPoolManager(poolManagerAddress);
        vm.deal(address(manager), 100_000_000 ether);

        // Additional helpers for interacting with the pool
        //posm = deployPosm(manager);
        //posmAddress = address(posm);
        posmAddress = 0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e;
        routerAddress = payable(0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af);
        router = UniversalRouter(routerAddress);
        posm = IPositionManager(posmAddress);
        vm.deal(address(posm), 100_000_000 ether);
        vm.startBroadcast();
        (lpRouter, swapRouter,) = deployRouters(manager);
        vm.stopBroadcast();


        // hook contracts must have specific flags encoded in the address
        uint160 permissions = uint160(
            Hooks.AFTER_SWAP_FLAG | Hooks.BEFORE_ADD_LIQUIDITY_FLAG | Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG
        );

        // Mine a salt that will produce a hook address with the correct permissions
        (address hookAddress, bytes32 salt) =
            HookMiner.find(CREATE2_DEPLOYER, permissions, type(FeeHook).creationCode, abi.encode(deployerAddress, poolManagerAddress, posmAddress, lzEndpoint, DESTINATION_CHAIN_ID, DESTINATION_EID, fakeTokenAddress));

        // ----------------------------- //
        // Deploy the hook using CREATE2 //
        // ----------------------------- //
        vm.broadcast();
        feeHook = new FeeHook{salt: salt}(deployerAddress, IPoolManager(poolManagerAddress), IPositionManager(posmAddress), lzEndpoint, DESTINATION_CHAIN_ID, DESTINATION_EID, fakeTokenAddress);
        require(address(feeHook) == hookAddress, "CounterScript: hook address mismatch");

        // test the lifecycle (create pool, add liquidity, swap)
        vm.startBroadcast();
        testLifecycle(hookAddress);
        vm.stopBroadcast();
    }

    // -----------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------
    function deployPoolManager() internal returns (IPoolManager) {
        return IPoolManager(address(new PoolManager(address(0))));
    }

    function deployRouters(IPoolManager _manager)
        internal
        returns (PoolModifyLiquidityTest _lpRouter, PoolSwapTest _swapRouter, PoolDonateTest _donateRouter)
    {
        _lpRouter = new PoolModifyLiquidityTest(_manager);
        _swapRouter = new PoolSwapTest(_manager);
        _donateRouter = new PoolDonateTest(_manager);
    }

    function deployPosm(IPoolManager poolManager) public returns (IPositionManager) {
        anvilPermit2();
        return IPositionManager(
            new PositionManager(poolManager, permit2, 300_000, IPositionDescriptor(address(0)), IWETH9(address(0)))
        );
    }

    function approveTokenWithPermit2(
        address token,
        uint160 amount,
        uint48 expiration
    ) external {
        IERC20(token).approve(address(permit2), type(uint256).max);
        permit2.approve(token, address(router), amount, expiration);
    }

    function approvePosmCurrency(IPositionManager _posm, Currency currency) internal {
        // Because POSM uses permit2, we must execute 2 permits/approvals.
        // 1. First, the caller must approve permit2 on the token.
        IERC20(Currency.unwrap(currency)).approve(address(permit2), type(uint256).max);
        // 2. Then, the caller must approve POSM as a spender of permit2
        permit2.approve(Currency.unwrap(currency), address(_posm), type(uint160).max, type(uint48).max);
    }

    function deployTokens() internal returns (MockERC20 token0, MockERC20 token1) {
        MockERC20 tokenA = new MockERC20("MockA", "A", 18);
        MockERC20 tokenB = new MockERC20("MockB", "B", 18);
        if (uint160(address(tokenA)) < uint160(address(tokenB))) {
            token0 = tokenA;
            token1 = tokenB;
        } else {
            token0 = tokenB;
            token1 = tokenA;
        }
    }

    function testLifecycle(address hookAddress) internal {
        (MockERC20 token0, MockERC20 token1) = deployTokens();
        token0.mint(msg.sender, 100_000 ether);
        token1.mint(msg.sender, 100_000 ether);

        // initialize the pool
        int24 tickSpacing = 60;
        PoolKey memory poolKey =
            PoolKey(CurrencyLibrary.ADDRESS_ZERO, Currency.wrap(address(token1)), FEE, tickSpacing, IHooks(hookAddress));
        manager.initialize(poolKey, Constants.SQRT_PRICE_1_1);

        // approve the tokens to the routers
        token0.approve(address(lpRouter), type(uint256).max);
        vm.deal(address(lpRouter), 100_000_000 ether);
        token1.approve(address(lpRouter), type(uint256).max);
        token0.approve(address(swapRouter), type(uint256).max);
        vm.deal(address(swapRouter), 100_000_000 ether);
        token1.approve(address(swapRouter), type(uint256).max);
        approvePosmCurrency(posm, Currency.wrap(address(token0)));
        approvePosmCurrency(posm, Currency.wrap(address(token1)));

        // add full range liquidity to the pool
        int24 tickLower = TickMath.minUsableTick(tickSpacing);
        int24 tickUpper = TickMath.maxUsableTick(tickSpacing);
        _exampleAddLiquidity(poolKey, tickLower, tickUpper, hookAddress);

        //// swap some tokens
        _exampleSwap(poolKey);

        //_exampleSwapReverse(poolKey);
        uint256 balanceBefore = address(deployerAddress).balance;
        feeHook.withdrawFees();
        uint256 balanceAfter = address(deployerAddress).balance;
        console.log("Balance before: ", balanceBefore);
        console.log("Balance after: ", balanceAfter);
        console.log('ownerOf: ', PositionManager(payable(address(posm))).ownerOf(feeHook.TOKEN_ID(poolKey.toId())));

        feeHook.transferPosition(
            deployerAddress,
            PoolId.unwrap(poolKey.toId())
        );
        console.log('ownerOf: ', PositionManager(payable(address(posm))).ownerOf(feeHook.TOKEN_ID(poolKey.toId())));
        uint256 tokenId = feeHook.TOKEN_ID(poolKey.toId());


        bytes memory burnActions = abi.encodePacked(uint8(Actions.BURN_POSITION), uint8(Actions.TAKE_PAIR));
        bytes[] memory burnParams = new bytes[](2);

        // Parameters for BURN_POSITION
        burnParams[0] = abi.encode(
            tokenId,      // Position to burn
            0,   // Minimum token0 to receive
            0,   // Minimum token1 to receive
            ""            // No hook data needed
        );

        // Parameters for TAKE_PAIR - where tokens will go
        burnParams[1] = abi.encode(
            poolKey.currency0,   // First token
            poolKey.currency1,   // Second token
            deployerAddress    // Who receives the tokens
        );
        posm.modifyLiquidities(
            abi.encode(burnActions, burnParams),
            block.timestamp + 60
        );
        uint256 balanceAfter2 = address(deployerAddress).balance;
        console.log("Balance after 2: ", balanceAfter2);


    }

    function _exampleAddLiquidity(PoolKey memory poolKey, int24 tickLower, int24 tickUpper, address hookAddress) internal returns (uint256){
        // provisions full-range liquidity twice. Two different periphery contracts used for example purposes.
        console.log("Adding liquidity to pool: ", tickUpper);
        // Pick on or the other
        IPoolManager.ModifyLiquidityParams memory liqParams =
            IPoolManager.ModifyLiquidityParams(tickLower, tickUpper, 100 ether, 0);
        //lpRouter.modifyLiquidity{value: 101 ether}(poolKey, liqParams, "");



        bytes memory actions = abi.encodePacked(uint8(Actions.MINT_POSITION), uint8(Actions.SETTLE_PAIR));

        bytes[] memory params = new bytes[](2);
        uint256 valueToPass = 100 ether;
        params[0] = abi.encode(poolKey, tickLower, tickUpper, valueToPass , 10_000e18, 10_000e18, hookAddress, bytes32(""));
        params[1] = abi.encode(poolKey.currency0, poolKey.currency1);
        posm.modifyLiquidities{value: valueToPass}(
            abi.encode(actions, params),
            block.timestamp + 300
        );

        //(uint256 tokenId,) = posm.mint(poolKey, tickLower, tickUpper, 100e18, 10_000e18, 10_000e18, msg.sender, block.timestamp + 300, "");
        return 0;
    }

    // trade eth for tokens
    function _exampleSwap(PoolKey memory poolKey) internal {
       uint128 amountSpecified = 1 ether;
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

       uint256 deadline = block.timestamp + 20;
       router.execute{value: amountSpecified}(commands, inputs, deadline);
    }

    // trade tokens for eth
    function _exampleSwapReverse(PoolKey memory poolKey) internal {
        bool zeroForOne = false;
        int256 amountSpecified = -1 ether;
        IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
            zeroForOne: zeroForOne,
            amountSpecified: amountSpecified,
            sqrtPriceLimitX96: zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1 // unlimited impact
        });
        PoolSwapTest.TestSettings memory testSettings =
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false});
        swapRouter.swap(poolKey, params, testSettings, "");
    }
}
