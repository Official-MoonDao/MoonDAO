// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "std/Script.sol";
import {IJBTerminal} from "@nana-core-v5/interfaces/IJBTerminal.sol";
import {JBConstants} from "@nana-core-v5/libraries/JBConstants.sol";
import {IDePrizeRegistry} from "../../src/deprize/IDePrizeRegistry.sol";
import {ILMSRMarketMaker} from "../../src/deprize/interfaces/ILMSRMarketMaker.sol";
import {IWETH} from "../../src/deprize/interfaces/IWETH.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "base/Config.sol";

/// @title DePrizeSweepFees
/// @notice Read-only Safe batch builder for the LMSR's accrued trade fees.
///         In v2 the Safe owns the market, so there is no on-chain router.
///
///         With DEPRIZE_FEE_TREASURY set, the batch is
///           1. market.withdrawFees()
///           2. WETH.transfer(treasury, amount)
///
///         Unset, a legacy prize whose terms send a live fee into the Juicebox pool gets
///           1. market.withdrawFees()
///           2. weth.withdraw(amount)
///           3. jbTerminal.pay(project, ...)   — omitted once terminal or a
///              cancellation notice is pending
///
///         Never broadcasts. Prints the sweepable amount and the calldata.
///
/// Env: DEPRIZE_REGISTRY DEPRIZE_ID DEPRIZE_MARKET DEPRIZE_OWNER (the Safe)
///      DEPRIZE_FEE_TREASURY (optional; WETH recipient)
contract DePrizeSweepFees is Script, Config {
    struct Plan {
        uint256 amount;
        bool toPrizePool;
        bytes withdrawFeesCall;
        bytes unwrapCall;
        bytes payCall;
        bytes transferCall;
    }

    /// @notice Pure planner so tests can assert the routing rule without an RPC.
    ///         A nonzero `treasury` sends the fees there as WETH; zero keeps the legacy route.
    function plan(
        IDePrizeRegistry registry,
        ILMSRMarketMaker market,
        IWETH weth,
        uint256 deprizeId,
        address safe,
        address treasury
    ) public view returns (Plan memory p) {
        require(market.owner() == safe, "market not owned by the Safe");
        IDePrizeRegistry.DePrize memory d = registry.getDePrize(deprizeId);
        require(market.conditionIds(0) == d.ctfConditionId, "market/registry condition mismatch");

        // Gnosis `withdrawFees` moves the market's standalone WETH balance; while
        // trade collateral is escrowed in the CTF that balance is exactly the fees.
        p.amount = weth.balanceOf(address(market));
        p.withdrawFeesCall = abi.encodeCall(ILMSRMarketMaker.withdrawFees, ());
        if (treasury != address(0)) {
            p.transferCall = abi.encodeCall(IERC20.transfer, (treasury, p.amount));
            return p;
        }
        p.toPrizePool = !registry.isTerminal(deprizeId) && !registry.cancellationPending(deprizeId);
        p.unwrapCall = abi.encodeCall(IWETH.withdraw, (p.amount));
        if (p.toPrizePool) {
            p.payCall = abi.encodeCall(
                IJBTerminal.pay, (d.jbProjectId, JBConstants.NATIVE_TOKEN, p.amount, safe, 0, "DePrize trade fees", "")
            );
        }
    }

    function run() external {
        IDePrizeRegistry registry = IDePrizeRegistry(vm.envAddress("DEPRIZE_REGISTRY"));
        ILMSRMarketMaker market = ILMSRMarketMaker(vm.envAddress("DEPRIZE_MARKET"));
        uint256 deprizeId = vm.envUint("DEPRIZE_ID");
        address safe = vm.envAddress("DEPRIZE_OWNER");
        (address wethAddr,) = requireDePrizeCollateral(block.chainid);
        IWETH weth = IWETH(wethAddr);

        address treasury = vm.envOr("DEPRIZE_FEE_TREASURY", address(0));
        Plan memory p = plan(registry, market, weth, deprizeId, safe, treasury);

        console.log("=== DePrize fee sweep (submit from the Safe) ===");
        console.log("DePrize id:     ", deprizeId);
        console.log("market:         ", address(market));
        console.log("sweepable WETH: ", p.amount);
        if (treasury != address(0)) console.log("route:           treasury WETH", treasury);
        else console.log("route:          ", p.toPrizePool ? "prize pool (Juicebox)" : "treasury (keep in Safe)");
        if (p.amount == 0) {
            console.log("Nothing to sweep.");
            return;
        }
        console.log("tx 1  to:", address(market));
        console.logBytes(p.withdrawFeesCall);
        if (treasury != address(0)) {
            console.log("tx 2  to:", wethAddr);
            console.logBytes(p.transferCall);
            return;
        }
        console.log("tx 2  to:", wethAddr);
        console.logBytes(p.unwrapCall);
        if (p.toPrizePool) {
            console.log("tx 3  to:", JB_V5_MULTI_TERMINAL, " value:", p.amount);
            console.logBytes(p.payCall);
        }
    }
}
