// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "std/Script.sol";
import {IDePrizeRegistry} from "../../src/deprize/IDePrizeRegistry.sol";
import {IConditionalTokens} from "../../src/deprize/interfaces/IConditionalTokens.sol";
import "base/Config.sol";

/// @title DePrizeResolve
/// @notice Read-only resolution pre-flight + Safe calldata builder. With the
///         multisig as the CTF oracle, `reportPayouts` must be submitted by the
///         Safe itself (the CTF derives the conditionId from `msg.sender`).
///         This script performs every consistency check that an on-chain
///         reporter would have enforced and prints the exact transaction for
///         the Safe — it never broadcasts anything.
///
/// Checks (any failure aborts):
///   1. registry state admits a report (SETTLED/M1_RELEASED/M2_COMPLETE ->
///      winner vector; NO_WINNER/CANCELLED -> equal-payout vector;
///      M2_FAILED -> refused, the CTF was already resolved at SETTLED);
///   2. the winner is one of the DePrize's outcome slots;
///   3. keccak256(oracle, questionId, N) matches the registry's conditionId
///      (catches a wrong questionId, wrong oracle, or wrong slot count);
///   4. the condition has not already been reported.
///
/// ⚠️ Submit only after the LMSR market is paused/closed — reporting against a
/// live market lets anyone trade the known outcome against treasury inventory.
///
/// Usage:
///   DEPRIZE_REGISTRY=0x<registryProxy> DEPRIZE_ID=1 \
///   DEPRIZE_QUESTION_ID=0x... DEPRIZE_ORACLE=0x<safe> \
///   forge script script/deprize/DePrizeResolve.s.sol --rpc-url $RPC
contract DePrizeResolve is Script, Config {
    error WrongState(uint256 deprizeId, IDePrizeRegistry.DePrizeState state);
    error M2FailedCtfAlreadyFinal(uint256 deprizeId);
    error WinnerNotFound(uint256 deprizeId, uint256 winningTeamId);
    error ConditionMismatch(bytes32 computed, bytes32 registered);
    error AlreadyReported(bytes32 conditionId, uint256 payoutDenominator);

    /// @notice Pure pre-flight: validates registry/CTF consistency and returns the
    ///         payout vector + `reportPayouts` calldata the oracle Safe must submit.
    function buildReport(
        IDePrizeRegistry registry,
        IConditionalTokens ctf,
        uint256 deprizeId,
        bytes32 questionId,
        address oracle
    ) public view returns (bytes32 conditionId, uint256[] memory payouts, bytes memory callData) {
        IDePrizeRegistry.DePrize memory dp = registry.getDePrize(deprizeId);
        uint256 n = dp.teamIds.length;
        payouts = new uint256[](n);

        if (
            dp.state == IDePrizeRegistry.DePrizeState.SETTLED
                || dp.state == IDePrizeRegistry.DePrizeState.M1_RELEASED
                || dp.state == IDePrizeRegistry.DePrizeState.M2_COMPLETE
        ) {
            // Winner declared: [0,…,1,…,0] at the winner's outcome slot.
            bool found;
            for (uint256 i = 0; i < n; i++) {
                if (dp.teamIds[i] == dp.winningTeamId) {
                    payouts[i] = 1;
                    found = true;
                    break;
                }
            }
            if (!found) revert WinnerNotFound(deprizeId, dp.winningTeamId);
        } else if (
            dp.state == IDePrizeRegistry.DePrizeState.NO_WINNER
                || dp.state == IDePrizeRegistry.DePrizeState.CANCELLED
        ) {
            // Refund terminal: equal payout, every token redeems at 1/N (the
            // disclosed parimutuel refund).
            for (uint256 i = 0; i < n; i++) {
                payouts[i] = 1;
            }
        } else if (dp.state == IDePrizeRegistry.DePrizeState.M2_FAILED) {
            // The winner vector was (or should have been) reported at SETTLED and
            // the CTF payout is write-once. Reaching M2_FAILED with an unreported
            // condition is a process failure that needs human judgment, not a
            // script-generated transaction.
            revert M2FailedCtfAlreadyFinal(deprizeId);
        } else {
            revert WrongState(deprizeId, dp.state);
        }

        // The conditionId binds oracle + questionId + slot count; recomputing it
        // makes a wrong questionId/oracle/N unsubmittable.
        conditionId = ctf.getConditionId(oracle, questionId, n);
        if (conditionId != dp.ctfConditionId) revert ConditionMismatch(conditionId, dp.ctfConditionId);

        uint256 den = ctf.payoutDenominator(conditionId);
        if (den != 0) revert AlreadyReported(conditionId, den);

        callData = abi.encodeCall(IConditionalTokens.reportPayouts, (questionId, payouts));
    }

    function run() external {
        IDePrizeRegistry registry = IDePrizeRegistry(vm.envAddress("DEPRIZE_REGISTRY"));
        IConditionalTokens ctf =
            IConditionalTokens(vm.envOr("DEPRIZE_CTF", CONDITIONAL_TOKENS_ADDRESSES[block.chainid]));
        uint256 deprizeId = vm.envUint("DEPRIZE_ID");
        bytes32 questionId = vm.envBytes32("DEPRIZE_QUESTION_ID");
        address oracle = vm.envAddress("DEPRIZE_ORACLE");

        (bytes32 conditionId, uint256[] memory payouts, bytes memory callData) =
            buildReport(registry, ctf, deprizeId, questionId, oracle);

        console.log("=== DePrize resolution (submit from the oracle Safe) ===");
        console.log("DePrize id:   ", deprizeId);
        console.log("Oracle (Safe):", oracle);
        console.log("conditionId:");
        console.logBytes32(conditionId);
        console.log("Payout vector:");
        for (uint256 i = 0; i < payouts.length; i++) {
            console.log("  slot", i, "->", payouts[i]);
        }
        console.log("Safe transaction:");
        console.log("  to:   ", address(ctf));
        console.log("  value: 0");
        console.log("  data:");
        console.logBytes(callData);
        console.log("REMINDER: pause/close the LMSR market BEFORE submitting this.");
    }
}
