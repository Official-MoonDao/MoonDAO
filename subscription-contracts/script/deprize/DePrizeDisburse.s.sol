// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "std/Script.sol";
import {IDePrizeRegistry} from "../../src/deprize/IDePrizeRegistry.sol";
import "base/Config.sol";

/// @dev Minimal Juicebox V5 terminal surface used to return prize ETH to the
///      mission project on the M2-failed refund path. `addToBalanceOf` is
///      permissionless and mints no tokens — it just raises the project balance
///      (and therefore the `$OVERVIEW` cashOut floor). See DEPRIZE_M5.md.
interface IJBTerminalLike {
    function addToBalanceOf(
        uint256 projectId,
        address token,
        uint256 amount,
        bool shouldReturnHeldFees,
        string calldata memo,
        bytes calldata metadata
    ) external payable;
}

/// @title DePrizeDisburse
/// @notice Read-only milestone-disbursement pre-flight + Safe calldata builder for
///         M5. The provider prize is paid in two milestones — 30% at M1 (capability
///         demonstrated) and 70% at M2 (mission delivered) — to the winning
///         provider's payout Safe recorded in the registry. On `M2_FAILED` the
///         undistributed 70% is returned to the Juicebox project (`addToBalanceOf`),
///         raising the `$OVERVIEW` cashOut floor for refundable bettors.
///
/// Why a script and not a contract: the mission's Juicebox payout splits are
/// permanently locked (treasury / poolDeployer / owner-Safe), so an escrow can
/// never be a split beneficiary. The prize ETH therefore lands in the admin Safe
/// via the normal locked payout, and disbursement is a Safe transaction. This
/// script performs the state-machine consistency checks and prints the exact
/// ordered Safe transactions — it never broadcasts anything. The same Safe is
/// already the registry owner, CTF oracle (M4) and project owner, so this adds no
/// new trust surface; it only enforces the 30/70 ordering off-chain.
///
/// Checks (any failure aborts):
///   1. registry state admits the requested milestone (M1 -> SETTLED, M2/REFUND ->
///      M1_RELEASED);
///   2. a non-zero provider payout address is recorded (M1/M2);
///   3. the prize-pool snapshot is non-zero.
///
/// `DEPRIZE_PRIZE_WEI` is the operator-recorded prize-pool snapshot at M1 (the
/// agreed figure the 30/70 split is computed against). Pass the SAME value for the
/// M2 and REFUND runs — the script derives the 70% remainder as
/// `prizeWei - floor(prizeWei * 30 / 100)` so M1 + M2 sum to it exactly.
///
/// Usage:
///   DEPRIZE_REGISTRY=0x<registryProxy> DEPRIZE_ID=1 \
///   DEPRIZE_MILESTONE=M1 DEPRIZE_PRIZE_WEI=<wei> \
///   forge script script/deprize/DePrizeDisburse.s.sol --rpc-url $RPC
contract DePrizeDisburse is Script, Config {
    /// @dev The Juicebox native-token sentinel (ETH).
    address constant NATIVE_TOKEN = 0x000000000000000000000000000000000000EEEe;

    uint256 constant M1_BPS = 30; // percent released at M1 (capability)

    bytes32 public constant M1 = keccak256("M1");
    bytes32 public constant M2 = keccak256("M2");
    bytes32 public constant REFUND = keccak256("REFUND");

    error UnknownMilestone(bytes32 milestone);
    error WrongState(uint256 deprizeId, IDePrizeRegistry.DePrizeState state);
    error ProviderNotSet(uint256 deprizeId);
    error ZeroPrize();

    struct Disbursement {
        bytes32 milestone; //     M1 / M2 / REFUND tag
        address registry; //      registry proxy (target of the state-advance tx)
        bytes registryCall; //    releaseM1 / completeM2 / failM2 calldata
        address payoutTo; //      provider Safe (M1/M2) OR the JB terminal (REFUND)
        uint256 payoutValue; //   ETH amount the Safe sends
        bytes payoutData; //      empty for a provider transfer; addToBalanceOf for REFUND
        uint256 jbProjectId; //   the mission's Juicebox project (for the refund leg)
    }

    /// @notice Pure pre-flight: validates registry state and returns the ordered Safe
    ///         transactions for the requested milestone.
    function buildDisbursement(
        IDePrizeRegistry registry,
        address jbTerminal,
        uint256 deprizeId,
        bytes32 milestone,
        uint256 prizeWei
    ) public view returns (Disbursement memory d) {
        if (prizeWei == 0) revert ZeroPrize();

        IDePrizeRegistry.DePrize memory dp = registry.getDePrize(deprizeId);
        address provider = registry.providerPayoutAddress(deprizeId);

        uint256 m1Amount = (prizeWei * M1_BPS) / 100;
        uint256 remainder = prizeWei - m1Amount; // exact: M1 + remainder == prizeWei

        d.milestone = milestone;
        d.registry = address(registry);
        d.jbProjectId = dp.jbProjectId;

        if (milestone == M1) {
            if (dp.state != IDePrizeRegistry.DePrizeState.SETTLED) revert WrongState(deprizeId, dp.state);
            if (provider == address(0)) revert ProviderNotSet(deprizeId);
            d.registryCall = abi.encodeCall(IDePrizeRegistry.releaseM1, (deprizeId));
            d.payoutTo = provider;
            d.payoutValue = m1Amount;
            d.payoutData = "";
        } else if (milestone == M2) {
            if (dp.state != IDePrizeRegistry.DePrizeState.M1_RELEASED) revert WrongState(deprizeId, dp.state);
            if (provider == address(0)) revert ProviderNotSet(deprizeId);
            d.registryCall = abi.encodeCall(IDePrizeRegistry.completeM2, (deprizeId));
            d.payoutTo = provider;
            d.payoutValue = remainder;
            d.payoutData = "";
        } else if (milestone == REFUND) {
            if (dp.state != IDePrizeRegistry.DePrizeState.M1_RELEASED) revert WrongState(deprizeId, dp.state);
            d.registry = jbTerminal;
            d.registryCall = abi.encodeCall(
                IJBTerminalLike.addToBalanceOf,
                (dp.jbProjectId, NATIVE_TOKEN, remainder, false, "DePrize M2_FAILED refund", "")
            );
            d.payoutTo = address(registry);
            d.payoutValue = remainder;
            d.payoutData = abi.encodeCall(IDePrizeRegistry.failM2, (deprizeId));
        } else {
            revert UnknownMilestone(milestone);
        }
    }

    function run() external {
        IDePrizeRegistry registry = IDePrizeRegistry(vm.envAddress("DEPRIZE_REGISTRY"));
        address jbTerminal = vm.envOr("DEPRIZE_JB_TERMINAL", JB_V5_MULTI_TERMINAL);
        uint256 deprizeId = vm.envUint("DEPRIZE_ID");
        bytes32 milestone = keccak256(bytes(vm.envString("DEPRIZE_MILESTONE")));
        uint256 prizeWei = vm.envUint("DEPRIZE_PRIZE_WEI");

        Disbursement memory d = buildDisbursement(registry, jbTerminal, deprizeId, milestone, prizeWei);

        console.log("=== DePrize milestone disbursement (submit from the admin Safe) ===");
        console.log("DePrize id:        ", deprizeId);
        console.log("Milestone:         ", vm.envString("DEPRIZE_MILESTONE"));
        console.log("Prize snapshot wei:", prizeWei);
        console.log("");
        if (d.milestone == REFUND) {
            console.log("Tx 1 (return 70% to Juicebox - raises $OVERVIEW cashOut floor):");
            console.log("  to:        ", d.registry);
            console.log("  value:     ", d.payoutValue);
            console.log("  jbProject: ", d.jbProjectId);
            console.log("  data:");
            console.logBytes(d.registryCall);
            console.log("");
            console.log("Tx 2 (advance registry state to M2_FAILED - enables refunds):");
            console.log("  to:   ", d.payoutTo);
            console.log("  value: 0");
            console.log("  data:");
            console.logBytes(d.payoutData);
        } else {
            console.log("Tx 1 (pay the provider):");
            console.log("  to:   ", d.payoutTo);
            console.log("  value:", d.payoutValue);
            console.log("  data:  0x (plain ETH transfer)");
            console.log("");
            console.log("Tx 2 (advance registry state):");
            console.log("  to:   ", d.registry);
            console.log("  value: 0");
            console.log("  data:");
            console.logBytes(d.registryCall);
        }
        console.log("");
        console.log("REMINDER: the Safe must already hold the prize ETH (extracted from");
        console.log("Juicebox via the locked owner-Safe payout). Submit Tx 1 then Tx 2.");
        console.log("For M1/M2: pay provider first, then advance state - ensures partial");
        console.log("failure doesn't lock funds that would later underfund a REFUND.");
    }
}
