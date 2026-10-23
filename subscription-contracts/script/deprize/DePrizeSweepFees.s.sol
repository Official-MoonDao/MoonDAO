// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "std/Script.sol";
import {IJBTerminal} from "@nana-core-v5/interfaces/IJBTerminal.sol";
import {JBConstants} from "@nana-core-v5/libraries/JBConstants.sol";
import {IDePrizeRegistry} from "../../src/deprize/IDePrizeRegistry.sol";
import {ILMSRMarketMaker} from "../../src/deprize/interfaces/ILMSRMarketMaker.sol";
import {IWETH} from "../../src/deprize/interfaces/IWETH.sol";
import "base/Config.sol";

/// @title DePrizeSweepFees
/// @notice Read-only Safe batch builder for routing the LMSR's accrued 1% trade
///         fees. In v2 the Safe owns the market, so there is no on-chain router:
///         the Safe periodically executes
///           1. market.withdrawFees()          — fees arrive in the Safe as WETH
///           2. weth.withdraw(amount)          — unwrap
///           3. jbTerminal.pay(project, ...)   — into the prize pool (while live)
///         Once the DePrize is terminal or a cancellation notice is pending, step
///         3 is omitted and the fees stay in the treasury (Terms 5.3): topping up
///         a refundable pool would distort the disclosed refund.
///
///         When `DEPRIZE_FEE_TREASURY` is set, step 3 is a native transfer to
///         that address instead of a Juicebox pay, including while the prize
///         is live. The public Arbitrum Touchdown uses this so the 1% fee
///         reaches the treasury and does not re-enter the prize pool.
///
///         Never broadcasts. Prints the sweepable amount and the calldata.
///
/// Env: DEPRIZE_REGISTRY DEPRIZE_ID DEPRIZE_MARKET DEPRIZE_OWNER (the Safe)
///      DEPRIZE_FEE_TREASURY (optional recipient of the unwrapped ETH)
contract DePrizeSweepFees is Script, Config {
    struct Plan {
        uint256 amount;
        bool toPrizePool;
        bytes withdrawFeesCall;
        bytes unwrapCall;
        bytes payCall;
        /// @dev Set when step 3 is an ETH transfer instead of `payCall`.
        address nativeRecipient;
    }

    /// @notice Pure planner so tests can assert the routing rule without an RPC.
    function plan(IDePrizeRegistry registry, ILMSRMarketMaker market, IWETH weth, uint256 deprizeId, address safe)
        public
        view
        returns (Plan memory)
    {
        return plan(registry, market, weth, deprizeId, safe, address(0));
    }

    /// @notice Same planner. A non-zero `treasury` sends the unwrapped fee there
    ///         instead of into the Juicebox prize pool, live or terminal.
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
        p.toPrizePool =
            treasury == address(0) && !registry.isTerminal(deprizeId) && !registry.cancellationPending(deprizeId);
        p.withdrawFeesCall = abi.encodeCall(ILMSRMarketMaker.withdrawFees, ());
        p.unwrapCall = abi.encodeCall(IWETH.withdraw, (p.amount));
        if (treasury != address(0)) {
            p.nativeRecipient = treasury;
        } else if (p.toPrizePool) {
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
        address treasury = vm.envOr("DEPRIZE_FEE_TREASURY", address(0));
        (address wethAddr,) = requireDePrizeCollateral(block.chainid);
        IWETH weth = IWETH(wethAddr);

        Plan memory p = plan(registry, market, weth, deprizeId, safe, treasury);

        console.log("=== DePrize fee sweep (submit from the Safe) ===");
        console.log("DePrize id:     ", deprizeId);
        console.log("market:         ", address(market));
        console.log("sweepable WETH: ", p.amount);
        console.log(
            "route:          ",
            p.nativeRecipient != address(0)
                ? "treasury (native transfer)"
                : p.toPrizePool ? "prize pool (Juicebox)" : "treasury (keep in Safe)"
        );
        if (p.amount == 0) {
            console.log("Nothing to sweep.");
            return;
        }
        console.log("tx 1  to:", address(market));
        console.logBytes(p.withdrawFeesCall);
        console.log("tx 2  to:", wethAddr);
        console.logBytes(p.unwrapCall);
        if (p.nativeRecipient != address(0)) {
            console.log("tx 3  to:", p.nativeRecipient, " value:", p.amount);
            console.log("empty calldata. The Safe sends the unwrapped ETH.");
        } else if (p.toPrizePool) {
            console.log("tx 3  to:", JB_V5_MULTI_TERMINAL, " value:", p.amount);
            console.logBytes(p.payCall);
        }
    }
}
