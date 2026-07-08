// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "std/Script.sol";
import "base/Config.sol";

import {ReopenPayHook} from "../src/ReopenPayHook.sol";

import {IJBController} from "@nana-core-v5/interfaces/IJBController.sol";
import {IJBProjects} from "@nana-core-v5/interfaces/IJBProjects.sol";
import {IJBRulesets} from "@nana-core-v5/interfaces/IJBRulesets.sol";
import {IJBRulesetApprovalHook} from "@nana-core-v5/interfaces/IJBRulesetApprovalHook.sol";
import {IJBSplitHook} from "@nana-core-v5/interfaces/IJBSplitHook.sol";

import {JBRuleset} from "@nana-core-v5/structs/JBRuleset.sol";
import {JBRulesetConfig} from "@nana-core-v5/structs/JBRulesetConfig.sol";
import {JBRulesetMetadata} from "@nana-core-v5/structs/JBRulesetMetadata.sol";
import {JBSplitGroup} from "@nana-core-v5/structs/JBSplitGroup.sol";
import {JBSplit} from "@nana-core-v5/structs/JBSplit.sol";
import {JBFundAccessLimitGroup} from "@nana-core-v5/structs/JBFundAccessLimitGroup.sol";
import {JBCurrencyAmount} from "@nana-core-v5/structs/JBCurrencyAmount.sol";
import {JBConstants} from "@nana-core-v5/libraries/JBConstants.sol";

/// @title SetupReopenOnFork
/// @notice Track B: broadcast the Frank re-open sequence onto a FORK of Arbitrum
///         (a local `anvil --fork-url ...` node) so the UI can read/write against a
///         chain that already carries the live re-open ruleset — with the REAL
///         project 73, real pot, and real backer set.
///
/// Unlike the Track A dry-run test (in-process simulation only), this script
/// **broadcasts** real transactions to the fork. The fork node must allow
/// impersonation of the project owner Safe (anvil: start with `--auto-impersonate`),
/// so we can act as the Safe without its private key.
///
/// Usage (from subscription-contracts/):
///   # 1. In terminal A, start the fork (see script/start-arbitrum-fork.sh):
///   anvil --fork-url $ARBITRUM_RPC_URL --auto-impersonate
///   # 2. In terminal B, broadcast the re-open (see script/run-reopen-on-fork.sh):
///   ./script/run-reopen-on-fork.sh
///
/// Or manually against any impersonation-capable fork RPC:
///   forge script script/SetupReopenOnFork.s.sol \
///     --rpc-url http://localhost:8545 \
///     --broadcast --unlocked \
///     --sender 0xaA1Bd6d001C0000420090EDb36bEAE0D9393B5EA \
///     -vvv
///
/// Env overrides: PROJECT_ID, PROJECT_OWNER, TERMINAL, TEAM_VESTING, MOONDAO_VESTING,
/// POOL_DEPLOYER, MOONDAO_TREASURY, FUNDING_GOAL, TOKENS_PER_ETH,
/// CAMPAIGN_DURATION_DAYS, REFUND_PERIOD_DAYS, CONTRIBUTIONS_JSON, SEED_BATCH_SIZE.
contract SetupReopenOnFork is Script, Config {
    uint256 constant DEFAULT_PROJECT_ID = 73;
    address constant DEFAULT_PROJECT_OWNER = 0xaA1Bd6d001C0000420090EDb36bEAE0D9393B5EA;
    address constant DEFAULT_TEAM_VESTING = 0x02430cC8e6932850a08D0c8820437A3229D8D6eb;
    address constant DEFAULT_MOONDAO_VESTING = 0x2f696B8102cE1214F7DfFFE4F3c99684e13Fc5b8;
    address constant DEFAULT_POOL_DEPLOYER = 0x95Fc39Dd278B8dCD7B0219d6E109717d8e539114;
    address constant DEFAULT_MOONDAO_TREASURY = 0xAF26a002d716508b7e375f1f620338442F5470c0;
    string constant DEFAULT_CONTRIBUTIONS_JSON = "script/backfill/frank-contributions.json";

    uint256 constant DEFAULT_FUNDING_GOAL = 2154 ether;
    uint256 constant DEFAULT_TOKENS_PER_ETH = 500;
    uint256 constant DEFAULT_CAMPAIGN_DURATION_DAYS = 548;
    uint256 constant DEFAULT_REFUND_PERIOD_DAYS = 28;
    uint256 constant DEFAULT_SEED_BATCH_SIZE = 25;

    function run() external {
        uint256 projectId = vm.envOr("PROJECT_ID", DEFAULT_PROJECT_ID);
        address projectOwner = vm.envOr("PROJECT_OWNER", DEFAULT_PROJECT_OWNER);
        address terminalAddress = vm.envOr("TERMINAL", JB_V5_MULTI_TERMINAL);
        address teamVesting = vm.envOr("TEAM_VESTING", DEFAULT_TEAM_VESTING);
        address moonDAOVesting = vm.envOr("MOONDAO_VESTING", DEFAULT_MOONDAO_VESTING);
        address poolDeployer = vm.envOr("POOL_DEPLOYER", DEFAULT_POOL_DEPLOYER);
        address moonDAOTreasury = vm.envOr("MOONDAO_TREASURY", DEFAULT_MOONDAO_TREASURY);
        uint256 fundingGoal = vm.envOr("FUNDING_GOAL", DEFAULT_FUNDING_GOAL);
        uint256 tokensPerEth = vm.envOr("TOKENS_PER_ETH", DEFAULT_TOKENS_PER_ETH);
        uint256 campaignDuration = vm.envOr("CAMPAIGN_DURATION_DAYS", DEFAULT_CAMPAIGN_DURATION_DAYS) * 1 days;
        uint256 refundPeriod = vm.envOr("REFUND_PERIOD_DAYS", DEFAULT_REFUND_PERIOD_DAYS) * 1 days;
        string memory contributionsJson = vm.envOr("CONTRIBUTIONS_JSON", DEFAULT_CONTRIBUTIONS_JSON);
        uint256 seedBatchSize = vm.envOr("SEED_BATCH_SIZE", DEFAULT_SEED_BATCH_SIZE);
        require(seedBatchSize > 0, "SEED_BATCH_SIZE must be > 0");

        uint256 reopenWeight = tokensPerEth * 2 * 1e18;

        IJBController jbController = IJBController(JB_V5_CONTROLLER);
        IJBProjects jbProjects = IJBProjects(JB_V5_PROJECTS);
        IJBRulesets jbRulesets = IJBRulesets(JB_V5_RULESETS);

        require(jbProjects.ownerOf(projectId) == projectOwner, "PROJECT_OWNER mismatch");

        console.log("=== Setup Frank re-open on fork ===");
        console.log("Project ID:", projectId);
        console.log("Project owner (Safe):", projectOwner);
        console.log("Contributor rate (tokens/ETH):", tokensPerEth);

        address[] memory reservedHolders = new address[](3);
        reservedHolders[0] = teamVesting;
        reservedHolders[1] = moonDAOVesting;
        reservedHolders[2] = poolDeployer;

        vm.startBroadcast(projectOwner);

        // 1. Deploy ReopenPayHook (owned by the Safe).
        ReopenPayHook hook = new ReopenPayHook(
            fundingGoal,
            block.timestamp + campaignDuration,
            refundPeriod,
            JB_V5_TERMINAL_STORE,
            JB_V5_RULESETS,
            JB_V5_CONTROLLER,
            JB_V5_TOKENS,
            reservedHolders,
            projectOwner
        );
        console.log("ReopenPayHook deployed:", address(hook));

        // 2. Seed original backers in batches (avoids block gas limits).
        (address[] memory holders, uint256[] memory eths, uint256[] memory toks) =
            _loadContributions(contributionsJson);
        uint256 seeded;
        for (uint256 start = 0; start < holders.length; start += seedBatchSize) {
            uint256 end = start + seedBatchSize;
            if (end > holders.length) end = holders.length;
            uint256 len = end - start;
            address[] memory batchHolders = new address[](len);
            uint256[] memory batchEth = new uint256[](len);
            uint256[] memory batchTok = new uint256[](len);
            for (uint256 i = 0; i < len; i++) {
                batchHolders[i] = holders[start + i];
                batchEth[i] = eths[start + i];
                batchTok[i] = toks[start + i];
            }
            hook.seedContributions(batchHolders, batchEth, batchTok);
            seeded += len;
            console.log("Seeded batch; total so far:", seeded);
        }

        // 3. Freeze the ledger.
        hook.lockLedger();
        console.log("Ledger locked.");

        // 4. Queue the re-open ruleset.
        JBRulesetConfig[] memory config = _buildReopenRulesetConfig(
            address(hook),
            terminalAddress,
            reopenWeight,
            moonDAOTreasury,
            teamVesting,
            moonDAOVesting,
            poolDeployer,
            projectOwner
        );
        uint256 newRulesetId = jbController.queueRulesetsOf(projectId, config, "Frank re-open (Tenderly preview)");
        console.log("Queued ruleset ID:", newRulesetId);

        // 5. Reset deadline to go-live (now + campaign duration).
        hook.setDeadline(block.timestamp + campaignDuration);
        console.log("Deadline set:", block.timestamp + campaignDuration);

        vm.stopBroadcast();

        // Post-broadcast sanity read (no broadcast).
        JBRuleset memory active = jbRulesets.currentOf(projectId);
        console.log("");
        console.log("=== DONE - re-open is live on the fork ===");
        console.log("Active ruleset weight:", uint256(active.weight));
        console.log("ReopenPayHook:", address(hook));
        console.log("Stage:", hook.stage(terminalAddress, projectId));
        console.log("");
        console.log("Next: point the UI at this fork RPC and open /mission/4:");
        console.log("  cd ui && NEXT_PUBLIC_CHAIN=mainnet \\");
        console.log("    NEXT_PUBLIC_ARBITRUM_RPC_URL=http://localhost:8545 yarn dev");
    }

    function _loadContributions(string memory path)
        internal
        returns (address[] memory holders, uint256[] memory eths, uint256[] memory toks)
    {
        string memory json = vm.readFile(path);
        holders = vm.parseJsonAddressArray(json, ".holders");
        string[] memory ethStr = vm.parseJsonStringArray(json, ".ethAmounts");
        string[] memory tokStr = vm.parseJsonStringArray(json, ".tokenAmounts");
        require(
            holders.length == ethStr.length && holders.length == tokStr.length,
            "Contributions JSON arrays length mismatch"
        );
        eths = new uint256[](ethStr.length);
        toks = new uint256[](tokStr.length);
        for (uint256 i = 0; i < holders.length; i++) {
            eths[i] = vm.parseUint(ethStr[i]);
            toks[i] = vm.parseUint(tokStr[i]);
        }
    }

    function _buildReopenRulesetConfig(
        address payHook,
        address terminal,
        uint256 weight,
        address moonDAOTreasury,
        address teamVesting,
        address moonDAOVesting,
        address poolDeployer,
        address owner
    ) internal pure returns (JBRulesetConfig[] memory) {
        JBSplitGroup[] memory splitGroups = new JBSplitGroup[](2);

        splitGroups[0] = JBSplitGroup({groupId: 0xEEEe, splits: new JBSplit[](3)});
        splitGroups[0].splits[0] = JBSplit({
            percent: 25_641_025,
            projectId: 0,
            preferAddToBalance: false,
            beneficiary: payable(moonDAOTreasury),
            lockedUntil: type(uint48).max,
            hook: IJBSplitHook(address(0))
        });
        splitGroups[0].splits[1] = JBSplit({
            percent: 51_282_051,
            projectId: 0,
            preferAddToBalance: false,
            beneficiary: payable(poolDeployer),
            lockedUntil: type(uint48).max,
            hook: IJBSplitHook(address(0))
        });
        splitGroups[0].splits[2] = JBSplit({
            percent: 923_076_923,
            projectId: 0,
            preferAddToBalance: false,
            beneficiary: payable(owner),
            lockedUntil: type(uint48).max,
            hook: IJBSplitHook(address(0))
        });

        splitGroups[1] = JBSplitGroup({groupId: 1, splits: new JBSplit[](3)});
        splitGroups[1].splits[0] = JBSplit({
            percent: 350_000_000,
            projectId: 0,
            preferAddToBalance: false,
            beneficiary: payable(moonDAOVesting),
            lockedUntil: type(uint48).max,
            hook: IJBSplitHook(address(0))
        });
        splitGroups[1].splits[1] = JBSplit({
            percent: 600_000_000,
            projectId: 0,
            preferAddToBalance: false,
            beneficiary: payable(teamVesting),
            lockedUntil: type(uint48).max,
            hook: IJBSplitHook(address(0))
        });
        splitGroups[1].splits[2] = JBSplit({
            percent: 50_000_000,
            projectId: 0,
            preferAddToBalance: false,
            beneficiary: payable(poolDeployer),
            lockedUntil: type(uint48).max,
            hook: IJBSplitHook(address(0))
        });

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
            duration: 0,
            weight: uint112(weight),
            weightCutPercent: 0,
            approvalHook: IJBRulesetApprovalHook(address(0)),
            metadata: JBRulesetMetadata({
                reservedPercent: 5_000,
                cashOutTaxRate: 0,
                baseCurrency: 61166,
                pausePay: false,
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
