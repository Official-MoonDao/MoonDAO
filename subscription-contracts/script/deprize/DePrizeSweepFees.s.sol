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
///         Set DEPRIZE_FEE_TREASURY (the public-prize path, and the Roles keeper)
///         and the batch is two calls:
///           1. market.withdrawFees()
///           2. WETH.transfer(treasury, amount)
///         The treasury receives WETH. There is no unwrap, so a role can scope
///         the transfer's recipient and nothing else.
///
///         Leave DEPRIZE_FEE_TREASURY unset for a legacy prize whose terms still
///         send a live fee into the Juicebox pool:
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
        bool toTreasury;
        address treasury;
        bytes withdrawFeesCall;
        bytes unwrapCall;
        bytes payCall;
        bytes transferCall;
    }

    /// @notice Legacy routing: prize pool while the prize is live.
    function plan(IDePrizeRegistry registry, ILMSRMarketMaker market, IWETH weth, uint256 deprizeId, address safe)
        public
        view
        returns (Plan memory p)
    {
        return plan(registry, market, weth, deprizeId, safe, address(0));
    }

    /// @notice When `treasury` is set, fees move as WETH to that address whether
    ///         or not the prize is still live. `address(0)` keeps the legacy route.
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
            p.toTreasury = true;
            p.treasury = treasury;
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
        if (p.toTreasury) {
            console.log("route:           treasury WETH", p.treasury);
        } else {
            console.log("route:          ", p.toPrizePool ? "prize pool (Juicebox)" : "keep in Safe (legacy terminal)");
            console.log("DEPRIZE_FEE_TREASURY unset. Set it to send WETH to the treasury.");
        }
        if (p.amount == 0) {
            console.log("Nothing to sweep.");
            return;
        }
        console.log("tx 1  to:", address(market));
        console.logBytes(p.withdrawFeesCall);
        if (p.toTreasury) {
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
