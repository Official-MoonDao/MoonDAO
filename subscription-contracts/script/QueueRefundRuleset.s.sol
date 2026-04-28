// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../src/MissionCreator.sol";
import "../src/LaunchPadPayHook.sol";
import "../src/LaunchPadApprovalHook.sol";
import {IJBController} from "@nana-core-v5/interfaces/IJBController.sol";
import {IJBTerminal} from "@nana-core-v5/interfaces/IJBTerminal.sol";
import {IJBDirectory} from "@nana-core-v5/interfaces/IJBDirectory.sol";
import {IJBRulesetApprovalHook} from "@nana-core-v5/interfaces/IJBRulesetApprovalHook.sol";
import {JBRulesetConfig} from "@nana-core-v5/structs/JBRulesetConfig.sol";
import {JBRulesetMetadata} from "@nana-core-v5/structs/JBRulesetMetadata.sol";
import {JBSplitGroup} from "@nana-core-v5/structs/JBSplitGroup.sol";
import {JBFundAccessLimitGroup} from "@nana-core-v5/structs/JBFundAccessLimitGroup.sol";
import {JBCurrencyAmount} from "@nana-core-v5/structs/JBCurrencyAmount.sol";
import {JBConstants} from "@nana-core-v5/libraries/JBConstants.sol";
import "base/Config.sol";

/// @title QueueRefundRuleset
/// @notice Script for the team multisig to queue a manual refund ruleset on a live mission.
///
/// Usage:
///   1. Set env vars: PRIVATE_KEY, MISSION_ID, MISSION_CREATOR_ADDRESS
///      Optional: REFUND_PERIOD_DAYS (default 28)
///   2. Run:
///      forge script script/QueueRefundRuleset.s.sol --rpc-url $RPC_URL --broadcast
///
/// What this does:
///   - Reads the existing mission data from the MissionCreator contract.
///   - Deploys new LaunchPadPayHook and LaunchPadApprovalHook with fresh timing
///     (deadline = now, refundPeriod = REFUND_PERIOD_DAYS).
///   - Enables refunds on both new hooks.
///   - Queues a new ruleset (copy of ruleset 0) on the JB project via jbController.queueRulesetsOf().
///   - The new ruleset uses the new hooks so contributors can cash out.
///
/// Prerequisites:
///   - The PRIVATE_KEY must correspond to the project owner (team multisig) or an
///     address with QUEUE_RULESETS permission on the JB project.
///   - The mission's original refund period may or may not have expired — this works either way.
contract QueueRefundRulesetScript is Script, Config {

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        uint256 missionId = vm.envUint("MISSION_ID");
        address missionCreatorAddress = vm.envAddress("MISSION_CREATOR_ADDRESS");

        // Default refund period is 28 days, configurable via env
        uint256 refundPeriodDays = 28;
        try vm.envUint("REFUND_PERIOD_DAYS") returns (uint256 val) {
            refundPeriodDays = val;
        } catch {}

        MissionCreator missionCreator = MissionCreator(missionCreatorAddress);
        IJBController jbControllerContract = IJBController(JB_V5_CONTROLLER);
        IJBDirectory jbDirectory = IJBDirectory(JB_V5_DIRECTORY);

        // Read mission data
        uint256 projectId = missionCreator.missionIdToProjectId(missionId);
        uint256 fundingGoal = missionCreator.missionIdToFundingGoal(missionId);
        address terminalAddress = missionCreator.missionIdToTerminal(missionId);

        require(projectId > 0, "Invalid mission: projectId is 0");
        require(terminalAddress != address(0), "Invalid mission: terminal is zero address");

        address deployer = vm.addr(deployerPrivateKey);

        console.log("=== Queue Refund Ruleset ===");
        console.log("Mission ID:", missionId);
        console.log("Project ID:", projectId);
        console.log("Funding Goal:", fundingGoal);
        console.log("Terminal:", terminalAddress);
        console.log("Deployer/Owner:", deployer);
        console.log("Refund Period:", refundPeriodDays, "days");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy new hooks with fresh timing
        uint256 newDeadline = block.timestamp; // Deadline = now, so refunds start immediately
        uint256 newRefundPeriod = refundPeriodDays * 1 days;

        LaunchPadPayHook newPayHook = new LaunchPadPayHook(
            fundingGoal,
            newDeadline,
            newRefundPeriod,
            JB_V5_TERMINAL_STORE,
            JB_V5_RULESETS,
            deployer // owner = deployer (team multisig)
        );
        console.log("New PayHook deployed:", address(newPayHook));

        LaunchPadApprovalHook newApprovalHook = new LaunchPadApprovalHook(
            fundingGoal,
            newDeadline,
            newRefundPeriod,
            JB_V5_TERMINAL_STORE,
            terminalAddress,
            deployer // owner = deployer (team multisig)
        );
        console.log("New ApprovalHook deployed:", address(newApprovalHook));

        // Wire approval hook to the new pay hook (single source of truth
        // for the `refundsEnabled` flag) and enable refunds on the pay hook.
        newApprovalHook.setPayHook(address(newPayHook));
        newPayHook.enableRefunds(true);
        console.log("Refunds enabled (single flag on pay hook)");

        // Build the refund ruleset config
        JBCurrencyAmount[] memory surplusAllowances = new JBCurrencyAmount[](1);
        surplusAllowances[0] = JBCurrencyAmount({
            amount: uint224(128_000_000 * 10 ** 18),
            currency: uint32(uint160(JBConstants.NATIVE_TOKEN))
        });

        JBFundAccessLimitGroup[] memory fundAccessLimitGroups = new JBFundAccessLimitGroup[](1);
        fundAccessLimitGroups[0] = JBFundAccessLimitGroup({
            terminal: terminalAddress,
            token: JBConstants.NATIVE_TOKEN,
            payoutLimits: new JBCurrencyAmount[](0),
            surplusAllowances: surplusAllowances
        });

        JBRulesetConfig[] memory rulesetConfigurations = new JBRulesetConfig[](1);
        rulesetConfigurations[0] = JBRulesetConfig({
            mustStartAtOrAfter: 0,
            duration: 0,
            weight: 2_000_000_000_000_000_000_000,
            weightCutPercent: 0,
            approvalHook: IJBRulesetApprovalHook(address(newApprovalHook)),
            metadata: JBRulesetMetadata({
                reservedPercent: 5_000,
                cashOutTaxRate: 0,
                baseCurrency: 61166,
                pausePay: true, // Pause new payments during refund
                pauseCreditTransfers: false,
                allowOwnerMinting: false,
                allowSetCustomToken: false,
                allowTerminalMigration: false,
                allowSetTerminals: false,
                allowSetController: false,
                allowAddAccountingContext: false,
                allowAddPriceFeed: false,
                ownerMustSendPayouts: false,
                holdFees: false,
                useTotalSurplusForCashOuts: false,
                useDataHookForPay: true,
                useDataHookForCashOut: true,
                dataHook: address(newPayHook),
                metadata: 0
            }),
            splitGroups: new JBSplitGroup[](0),
            fundAccessLimitGroups: fundAccessLimitGroups
        });

        // Queue the ruleset
        uint256 newRulesetId = jbControllerContract.queueRulesetsOf(
            projectId,
            rulesetConfigurations,
            "Queuing refund ruleset - manual refund for mission"
        );
        console.log("New ruleset queued with ID:", newRulesetId);

        vm.stopBroadcast();

        console.log("");
        console.log("=== SUCCESS ===");
        console.log("Refund ruleset has been queued.");
        console.log("Contributors can now cash out their tokens for a refund.");
        console.log("Refund window expires at:", block.timestamp + newRefundPeriod);
    }
}
