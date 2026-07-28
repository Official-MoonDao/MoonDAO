// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../src/MissionCreator.sol";
import "../src/ReopenPayHook.sol";
import {IJBController} from "@nana-core-v5/interfaces/IJBController.sol";
import {IJBProjects} from "@nana-core-v5/interfaces/IJBProjects.sol";
import {IJBRulesetApprovalHook} from "@nana-core-v5/interfaces/IJBRulesetApprovalHook.sol";
import {IJBSplitHook} from "@nana-core-v5/interfaces/IJBSplitHook.sol";
import {JBRulesetConfig} from "@nana-core-v5/structs/JBRulesetConfig.sol";
import {JBRulesetMetadata} from "@nana-core-v5/structs/JBRulesetMetadata.sol";
import {JBSplitGroup} from "@nana-core-v5/structs/JBSplitGroup.sol";
import {JBSplit} from "@nana-core-v5/structs/JBSplit.sol";
import {JBFundAccessLimitGroup} from "@nana-core-v5/structs/JBFundAccessLimitGroup.sol";
import {JBCurrencyAmount} from "@nana-core-v5/structs/JBCurrencyAmount.sol";
import {JBConstants} from "@nana-core-v5/libraries/JBConstants.sol";
import "base/Config.sol";

/// @title QueueReopenRuleset
/// @notice Re-opens fundraising on a closed mission by queuing a new ruleset with a
///         fresh deadline and a new token issuance rate.
///
/// Built for the "Send Frank to Space" re-open (Phase 1 of the reopening plan):
///   - Contributors receive TOKENS_PER_ETH (default 500 $OVERVIEW/ETH — half the
///     original 1,000/ETH rate). Implemented as ruleset weight = TOKENS_PER_ETH * 2
///     because 50% of minted tokens are reserved, matching the original mission.
///   - No decay (weightCutPercent = 0) and no approval hook: the ruleset lasts until
///     the team queues the next one, so the rate can be stepped down manually one
///     cycle at a time by re-running this script with a lower TOKENS_PER_ETH.
///   - Original contributor balances are untouched.
///   - Payouts stay locked: the re-open ruleset has no payout limits. Only the
///     surplus allowance (same as the original funding ruleset) is available.
///   - Refunds are exact for mixed-rate cohorts: the deployed ReopenPayHook derives
///     the cash-out denominator from real on-chain supply (not funding * weight), so
///     if the goal is missed at the new deadline, claims are pro-rata by token,
///     order-independent, and sum exactly to the pot. See src/ReopenPayHook.sol and
///     testMixedRateRefundDistributesProRata in ReopenRulesetTest.t.sol.
///
/// Usage:
///   1. Set env vars: PRIVATE_KEY, MISSION_ID, MISSION_CREATOR_ADDRESS
///      Optional:
///        TOKENS_PER_ETH         tokens minted to the contributor per ETH (default 500)
///        CAMPAIGN_DURATION_DAYS days until the new funding deadline (default 548 ≈ 18 months)
///        REFUND_PERIOD_DAYS     refund window after the deadline (default 28)
///        FUNDING_GOAL           wei; defaults to the goal stored in MissionCreator
///        QUEUE_VIA_SENDER       "true" to call queueRulesetsOf directly (sender must
///                               own the project or have QUEUE_RULESETS permission).
///                               Default: only deploy the hook and print the calldata
///                               for the team Safe's Transaction Builder.
///        REOPEN_PAY_HOOK_ADDRESS  address of an already-deployed ReopenPayHook to reuse
///                               instead of deploying a new one. Use this when generating
///                               Safe calldata after a separate hook deployment to avoid
///                               nonce-dependent address mismatches.
///
///   Note on deadline timing: the hook's deadline is set at deploy time to
///   now + CAMPAIGN_DURATION_DAYS. When the hook is deployed in a separate
///   transaction before the Safe queues the ruleset, that gap shortens the
///   live campaign window. To reset the countdown to the actual go-live time,
///   the project owner (team Safe) should call setDeadline(block.timestamp +
///   CAMPAIGN_DURATION_DAYS) on the ReopenPayHook immediately after the ruleset
///   becomes active — or include that call in the same Safe batch that queues
///   the ruleset (using REOPEN_PAY_HOOK_ADDRESS to reference the pre-deployed hook).
///
///      Override env vars (required when MissionCreator mappings return 0x0 — e.g. Frank mission):
///        PROJECT_ID      Juicebox project id (MissionCreator.missionIdToProjectId is 0)
///        FUNDING_GOAL    wei (MissionCreator.missionIdToFundingGoal is 0)
///        TEAM_VESTING    address that receives reserved tokens for the team
///        MOONDAO_VESTING address that receives reserved tokens for MoonDAO
///        POOL_DEPLOYER   address that receives reserved tokens / ETH payout share for the pool
///        TERMINAL        address of the JB terminal for this project
///
///      Frank mission (ID 4, Project 73) — confirmed addresses from original creation tx
///      (0xb674a3df953b583b3ba6bc06f8c282e3344d560a96e6d8de7a7effc44e5824c1):
///        PROJECT_ID=73
///        FUNDING_GOAL=2154000000000000000000   (2154 ether)
///        TEAM_VESTING=0x02430cc8e6932850a08d0c8820437a3229d8d6eb
///        MOONDAO_VESTING=0x2f696b8102ce1214f7dfffe4f3c99684e13fc5b8
///        POOL_DEPLOYER=0x95fc39dd278b8dcd7b0219d6e109717d8e539114
///        TERMINAL=0x2dB6d704058E552DeFE415753465df8dF0361846
///   2. Run:
///      forge script script/QueueReopenRuleset.s.sol --rpc-url $RPC_URL --broadcast --via-ir
///
/// What this does:
///   - Reads the mission's project id, terminal, vesting and pool addresses from MissionCreator.
///   - Deploys a new ReopenPayHook owned by the project owner (team Safe) with
///     deadline = now + CAMPAIGN_DURATION_DAYS. Refunds are NOT force-enabled; the
///     standard goal/deadline logic applies. ReopenPayHook (not LaunchPadPayHook)
///     is required because token holders from the original raise minted at a
///     different rate: its cash-out math uses real on-chain supply, so refunds
///     stay exact for mixed-rate cohorts (see src/ReopenPayHook.sol).
///   - Builds a re-open ruleset that mirrors the original funding ruleset (50% reserved,
///     same split beneficiaries) but with the new weight and data hook.
///   - Queues it via jbController.queueRulesetsOf() or prints the calldata for the Safe.
///
/// Approval note: the queued ruleset activates according to the approval hook of the
/// ruleset currently in effect. For a mission whose original refund window has expired,
/// the active ruleset is the payouts ruleset (no approval hook), so the re-open ruleset
/// takes effect as soon as it is queued.
contract QueueReopenRulesetScript is Script, Config {

    uint256 constant DEFAULT_TOKENS_PER_ETH = 500;
    uint256 constant DEFAULT_CAMPAIGN_DURATION_DAYS = 548; // ~18 months
    uint256 constant DEFAULT_REFUND_PERIOD_DAYS = 28;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        uint256 missionId = vm.envUint("MISSION_ID");
        address missionCreatorAddress = vm.envAddress("MISSION_CREATOR_ADDRESS");

        uint256 tokensPerEth = DEFAULT_TOKENS_PER_ETH;
        try vm.envUint("TOKENS_PER_ETH") returns (uint256 val) {
            tokensPerEth = val;
        } catch {}

        uint256 campaignDurationDays = DEFAULT_CAMPAIGN_DURATION_DAYS;
        try vm.envUint("CAMPAIGN_DURATION_DAYS") returns (uint256 val) {
            campaignDurationDays = val;
        } catch {}

        uint256 refundPeriodDays = DEFAULT_REFUND_PERIOD_DAYS;
        try vm.envUint("REFUND_PERIOD_DAYS") returns (uint256 val) {
            refundPeriodDays = val;
        } catch {}

        bool queueViaSender = false;
        try vm.envBool("QUEUE_VIA_SENDER") returns (bool val) {
            queueViaSender = val;
        } catch {}

        address existingPayHook = address(0);
        try vm.envAddress("REOPEN_PAY_HOOK_ADDRESS") returns (address val) {
            existingPayHook = val;
        } catch {}

        MissionCreator missionCreator = MissionCreator(missionCreatorAddress);
        IJBController jbControllerContract = IJBController(JB_V5_CONTROLLER);
        IJBProjects jbProjectsContract = IJBProjects(JB_V5_PROJECTS);

        // Read mission data
        uint256 projectId = missionCreator.missionIdToProjectId(missionId);
        address terminalAddress = missionCreator.missionIdToTerminal(missionId);
        address teamVesting = missionCreator.missionIdToTeamVesting(missionId);
        address moonDAOVesting = missionCreator.missionIdToMoonDAOVesting(missionId);
        address poolDeployer = missionCreator.missionIdToPoolDeployer(missionId);
        address moonDAOTreasury = missionCreator.moonDAOTreasury();

        // Allow env var overrides for missions whose MissionCreator mappings are 0x0
        // (e.g. Frank mission ID 4 was created via an older MissionCreator version, so
        // the current MissionCreator returns projectId 0 / empty vesting for it).
        try vm.envUint("PROJECT_ID") returns (uint256 val) { projectId = val; } catch {}
        try vm.envAddress("TEAM_VESTING") returns (address val) { teamVesting = val; } catch {}
        try vm.envAddress("MOONDAO_VESTING") returns (address val) { moonDAOVesting = val; } catch {}
        try vm.envAddress("POOL_DEPLOYER") returns (address val) { poolDeployer = val; } catch {}
        try vm.envAddress("TERMINAL") returns (address val) { terminalAddress = val; } catch {}

        uint256 fundingGoal = missionCreator.missionIdToFundingGoal(missionId);
        try vm.envUint("FUNDING_GOAL") returns (uint256 val) {
            fundingGoal = val;
        } catch {}

        require(projectId > 0, "Invalid mission: projectId is 0");
        require(terminalAddress != address(0), "Invalid mission: terminal is zero address");
        require(tokensPerEth > 0, "TOKENS_PER_ETH must be > 0");
        // Ruleset weight is a uint112; also guard against fat-fingered env values
        // (1e9 tokens/ETH ceiling keeps weight at 2e27 << type(uint112).max ≈ 5.2e33).
        require(tokensPerEth <= 1_000_000_000, "TOKENS_PER_ETH too large");
        require(fundingGoal > 0, "FUNDING_GOAL must be > 0");
        require(campaignDurationDays > 0 && campaignDurationDays <= 3650, "CAMPAIGN_DURATION_DAYS out of range");
        require(refundPeriodDays > 0, "REFUND_PERIOD_DAYS must be > 0");

        // Project owner (team Safe) owns the new hook so it can toggle funding,
        // enable refunds, or attach the DePrize registry later.
        address projectOwner = jbProjectsContract.ownerOf(projectId);

        // 50% of minted tokens are reserved, so the total weight is double the
        // contributor rate. Original mission: weight 2,000e18 → 1,000/ETH to funder.
        uint256 weight = tokensPerEth * 2 * 1e18;

        uint256 newDeadline = block.timestamp + campaignDurationDays * 1 days;
        uint256 newRefundPeriod = refundPeriodDays * 1 days;

        console.log("=== Queue Re-open Ruleset ===");
        console.log("Mission ID:", missionId);
        console.log("Project ID:", projectId);
        console.log("Project Owner (Safe):", projectOwner);
        console.log("Terminal:", terminalAddress);
        console.log("Funding Goal (wei):", fundingGoal);
        console.log("Contributor rate (tokens/ETH):", tokensPerEth);
        console.log("Ruleset weight:", weight);
        console.log("New deadline:", newDeadline);
        console.log("Refund period (days):", refundPeriodDays);

        // Reserved-token allocation holders are excluded from the refund denominator
        // and blocked from cashing out (they hold the reserved side of every mint).
        address[] memory reservedHolders = new address[](3);
        reservedHolders[0] = teamVesting;
        reservedHolders[1] = moonDAOVesting;
        reservedHolders[2] = poolDeployer;

        vm.startBroadcast(deployerPrivateKey);

        address payHookAddress;
        if (existingPayHook != address(0)) {
            payHookAddress = existingPayHook;
            console.log("Using existing PayHook:", payHookAddress);
        } else {
            // WARNING: Deploying a fresh hook resets the deposit ledger (ethContributed).
            // If this is a RATE UPDATE on an already-live reopen, set REOPEN_PAY_HOOK_ADDRESS
            // to the existing hook address so prior backers remain refundable.
            // Only omit REOPEN_PAY_HOOK_ADDRESS for the very first reopen deployment.
            console.log("WARNING: No REOPEN_PAY_HOOK_ADDRESS set - deploying a new hook.");
            console.log("If this is a rate update, set REOPEN_PAY_HOOK_ADDRESS to the existing hook to preserve the deposit ledger.");
            ReopenPayHook newPayHook = new ReopenPayHook(
                fundingGoal,
                newDeadline,
                newRefundPeriod,
                JB_V5_TERMINAL_STORE,
                JB_V5_RULESETS,
                JB_V5_CONTROLLER,
                JB_V5_TOKENS,
                reservedHolders,
                projectOwner
            );
            payHookAddress = address(newPayHook);
            console.log("New PayHook deployed:", payHookAddress);
        }

        JBRulesetConfig[] memory rulesetConfigurations = _buildReopenRulesetConfig(
            payHookAddress,
            terminalAddress,
            weight,
            moonDAOTreasury,
            teamVesting,
            moonDAOVesting,
            poolDeployer,
            projectOwner
        );

        string memory memo = string.concat(
            "Re-opening Launchpad funding at ",
            vm.toString(tokensPerEth),
            " tokens/ETH"
        );

        if (queueViaSender) {
            uint256 newRulesetId = jbControllerContract.queueRulesetsOf(
                projectId,
                rulesetConfigurations,
                memo
            );
            console.log("New ruleset queued with ID:", newRulesetId);
        } else {
            bytes memory queueCalldata = abi.encodeWithSelector(
                IJBController.queueRulesetsOf.selector,
                projectId,
                rulesetConfigurations,
                memo
            );
            console.log("");
            console.log("Propose this transaction from the team Safe (Transaction Builder):");
            console.log("To (JB Controller):", JB_V5_CONTROLLER);
            console.log("Value: 0");
            console.log("Data:");
            console.logBytes(queueCalldata);
        }

        vm.stopBroadcast();

        console.log("");
        console.log("=== DONE ===");
        console.log("Once the ruleset is active, contributions mint at the new rate.");
        console.log("To change the rate later, re-run this script with a different TOKENS_PER_ETH.");
    }

    /// @dev Mirrors the original funding ruleset from MissionCreator.createMission():
    ///      50% reserved tokens split between MoonDAO vesting (35%), team vesting (60%)
    ///      and the AMM pool deployer (5%); payout splits kept identical; no payout
    ///      limits (payouts locked during the raise); unlimited surplus allowance.
    function _buildReopenRulesetConfig(
        address payHook,
        address terminal,
        uint256 weight,
        address moonDAOTreasury,
        address teamVesting,
        address moonDAOVesting,
        address poolDeployer,
        address projectOwner
    ) internal pure returns (JBRulesetConfig[] memory) {
        JBSplitGroup[] memory splitGroups = new JBSplitGroup[](2);

        // ETH payout splits (only relevant if payouts are ever unlocked on a later ruleset)
        splitGroups[0] = JBSplitGroup({
            groupId: 0xEEEe,
            splits: new JBSplit[](3)
        });
        splitGroups[0].splits[0] = JBSplit({
            percent: 25_641_025, // 2.5% after 2.5% jb fee
            projectId: 0,
            preferAddToBalance: false,
            beneficiary: payable(moonDAOTreasury),
            lockedUntil: type(uint48).max,
            hook: IJBSplitHook(address(0))
        });
        splitGroups[0].splits[1] = JBSplit({
            percent: 51_282_051, // 5% after 2.5% jb fee
            projectId: 0,
            preferAddToBalance: false,
            beneficiary: payable(poolDeployer),
            lockedUntil: type(uint48).max,
            hook: IJBSplitHook(address(0))
        });
        splitGroups[0].splits[2] = JBSplit({
            percent: 923_076_923, // 90% after 2.5% jb fee
            projectId: 0,
            preferAddToBalance: false,
            beneficiary: payable(projectOwner),
            lockedUntil: type(uint48).max,
            hook: IJBSplitHook(address(0))
        });

        // Reserved token splits (50% of every mint)
        splitGroups[1] = JBSplitGroup({
            groupId: 1,
            splits: new JBSplit[](3)
        });
        splitGroups[1].splits[0] = JBSplit({
            percent: 350_000_000, // 35% of reserved = 17.5% of total
            projectId: 0,
            preferAddToBalance: false,
            beneficiary: payable(moonDAOVesting),
            lockedUntil: type(uint48).max,
            hook: IJBSplitHook(address(0))
        });
        splitGroups[1].splits[1] = JBSplit({
            percent: 600_000_000, // 60% of reserved = 30% of total
            projectId: 0,
            preferAddToBalance: false,
            beneficiary: payable(teamVesting),
            lockedUntil: type(uint48).max,
            hook: IJBSplitHook(address(0))
        });
        splitGroups[1].splits[2] = JBSplit({
            percent: 50_000_000, // 5% of reserved = 2.5% of total
            projectId: 0,
            preferAddToBalance: false,
            beneficiary: payable(poolDeployer),
            lockedUntil: type(uint48).max,
            hook: IJBSplitHook(address(0))
        });

        // Same functionally-unlimited surplus allowance as the original funding
        // ruleset; no payout limits so payouts stay locked during the raise.
        JBCurrencyAmount[] memory surplusAllowances = new JBCurrencyAmount[](1);
        surplusAllowances[0] = JBCurrencyAmount({
            amount: uint224(128_000_000 * 10 ** 18),
            currency: uint32(uint160(JBConstants.NATIVE_TOKEN))
        });

        JBFundAccessLimitGroup[] memory fundAccessLimitGroups = new JBFundAccessLimitGroup[](1);
        fundAccessLimitGroups[0] = JBFundAccessLimitGroup({
            terminal: terminal,
            token: JBConstants.NATIVE_TOKEN,
            payoutLimits: new JBCurrencyAmount[](0),
            surplusAllowances: surplusAllowances
        });

        JBRulesetConfig[] memory rulesetConfigurations = new JBRulesetConfig[](1);
        rulesetConfigurations[0] = JBRulesetConfig({
            mustStartAtOrAfter: 0,
            duration: 0, // lasts until the team queues the next ruleset (rate updates are manual)
            weight: uint112(weight),
            weightCutPercent: 0, // no automatic decay
            // No approval hook: the team can queue the next ruleset (rate change,
            // payouts unlock, or refund) at any time and it takes effect immediately.
            approvalHook: IJBRulesetApprovalHook(address(0)),
            metadata: JBRulesetMetadata({
                reservedPercent: 5_000, // 50% reserved, same as the original mission
                cashOutTaxRate: 0,
                baseCurrency: 61166, // ETH
                pausePay: false, // contributions are open
                // Refund claims are tracked per contributor (deposit ledger); pausing
                // credit transfers keeps token holdings aligned with those claims.
                pauseCreditTransfers: true,
                allowOwnerMinting: false,
                allowSetCustomToken: false,
                allowTerminalMigration: false,
                allowSetTerminals: false,
                allowSetController: false,
                allowAddAccountingContext: false,
                allowAddPriceFeed: false,
                ownerMustSendPayouts: true,
                holdFees: false,
                useTotalSurplusForCashOuts: false,
                useDataHookForPay: true,
                useDataHookForCashOut: true,
                dataHook: payHook,
                metadata: 0
            }),
            splitGroups: splitGroups,
            fundAccessLimitGroups: fundAccessLimitGroups
        });

        return rulesetConfigurations;
    }
}
