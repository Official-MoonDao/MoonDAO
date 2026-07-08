// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "std/Script.sol";
import "base/Config.sol";

import {ReopenPayHook} from "../src/ReopenPayHook.sol";

import {IJBController} from "@nana-core-v5/interfaces/IJBController.sol";
import {IJBRulesetApprovalHook} from "@nana-core-v5/interfaces/IJBRulesetApprovalHook.sol";
import {IJBSplitHook} from "@nana-core-v5/interfaces/IJBSplitHook.sol";

import {JBRulesetConfig} from "@nana-core-v5/structs/JBRulesetConfig.sol";
import {JBRulesetMetadata} from "@nana-core-v5/structs/JBRulesetMetadata.sol";
import {JBSplitGroup} from "@nana-core-v5/structs/JBSplitGroup.sol";
import {JBSplit} from "@nana-core-v5/structs/JBSplit.sol";
import {JBFundAccessLimitGroup} from "@nana-core-v5/structs/JBFundAccessLimitGroup.sol";
import {JBCurrencyAmount} from "@nana-core-v5/structs/JBCurrencyAmount.sol";
import {JBConstants} from "@nana-core-v5/libraries/JBConstants.sol";

/// @title PrintReopenSafeBatch
/// @notice Emits the exact calldata for the "go-live" Frank re-open batch so it can be
///         executed by the project owner Safe (no broadcast, no RPC required).
///
/// It prints, and writes an importable Safe {Wallet} Transaction Builder JSON for:
///   1..N  seedContributions(holders, eth, tokens)  -> ReopenPayHook  (batched)
///   N+1   lockLedger()                             -> ReopenPayHook
///   N+2   queueRulesetsOf(projectId, config, memo) -> JB Controller
///   N+3   setDeadline(DEADLINE_TIMESTAMP)          -> ReopenPayHook
///
/// The batch targets an ALREADY-DEPLOYED ReopenPayHook (deploy it first with
/// QueueReopenRuleset.s.sol, then pass its address here) so the seed/lock/queue/deadline
/// calls all reference the real hook. Because a Safe batch is built ahead of execution,
/// the new deadline is a FIXED unix timestamp you provide (DEADLINE_TIMESTAMP), not
/// `block.timestamp + campaign` — set it to your intended go-live time + campaign length.
///
/// Order rationale: seed before lock (seeding reverts once locked), lock before the
/// ruleset goes live (freeze the refund ledger before any new contribution), queue the
/// re-open ruleset, then reset the countdown. All four run atomically in one Safe batch.
///
/// Usage (from subscription-contracts/, no --broadcast, no --rpc-url needed):
///   REOPEN_PAY_HOOK_ADDRESS=0x<deployed hook> \
///   DEADLINE_TIMESTAMP=<unix seconds: go-live + campaign> \
///   forge script script/PrintReopenSafeBatch.s.sol --via-ir -vvv
///
/// Env overrides: PROJECT_ID, SAFE (project owner), TERMINAL, TEAM_VESTING,
/// MOONDAO_VESTING, POOL_DEPLOYER, MOONDAO_TREASURY, TOKENS_PER_ETH, CHAIN_ID,
/// CONTRIBUTIONS_JSON, SEED_BATCH_SIZE, MEMO, OUTPUT_JSON.
contract PrintReopenSafeBatch is Script, Config {
    uint256 constant DEFAULT_PROJECT_ID = 73;
    address constant DEFAULT_SAFE = 0xaA1Bd6d001C0000420090EDb36bEAE0D9393B5EA;
    address constant DEFAULT_TEAM_VESTING = 0x02430cC8e6932850a08D0c8820437A3229D8D6eb;
    address constant DEFAULT_MOONDAO_VESTING = 0x2f696B8102cE1214F7DfFFE4F3c99684e13Fc5b8;
    address constant DEFAULT_POOL_DEPLOYER = 0x95Fc39Dd278B8dCD7B0219d6E109717d8e539114;
    address constant DEFAULT_MOONDAO_TREASURY = 0xAF26a002d716508b7e375f1f620338442F5470c0;
    string constant DEFAULT_CONTRIBUTIONS_JSON = "script/backfill/frank-contributions.json";
    string constant DEFAULT_OUTPUT_JSON = "script/safe-tx-reopen-batch.json";

    uint256 constant DEFAULT_TOKENS_PER_ETH = 500;
    uint256 constant DEFAULT_SEED_BATCH_SIZE = 25;
    uint256 constant DEFAULT_CHAIN_ID = 42161;

    function run() external {
        address hook = vm.envAddress("REOPEN_PAY_HOOK_ADDRESS");
        uint256 deadlineTs = vm.envUint("DEADLINE_TIMESTAMP");

        uint256 projectId = vm.envOr("PROJECT_ID", DEFAULT_PROJECT_ID);
        address safe = vm.envOr("SAFE", DEFAULT_SAFE);
        address terminalAddress = vm.envOr("TERMINAL", JB_V5_MULTI_TERMINAL);
        address teamVesting = vm.envOr("TEAM_VESTING", DEFAULT_TEAM_VESTING);
        address moonDAOVesting = vm.envOr("MOONDAO_VESTING", DEFAULT_MOONDAO_VESTING);
        address poolDeployer = vm.envOr("POOL_DEPLOYER", DEFAULT_POOL_DEPLOYER);
        address moonDAOTreasury = vm.envOr("MOONDAO_TREASURY", DEFAULT_MOONDAO_TREASURY);
        uint256 tokensPerEth = vm.envOr("TOKENS_PER_ETH", DEFAULT_TOKENS_PER_ETH);
        uint256 seedBatchSize = vm.envOr("SEED_BATCH_SIZE", DEFAULT_SEED_BATCH_SIZE);
        uint256 chainId = vm.envOr("CHAIN_ID", DEFAULT_CHAIN_ID);
        string memory contributionsJson = vm.envOr("CONTRIBUTIONS_JSON", DEFAULT_CONTRIBUTIONS_JSON);
        string memory outputJson = vm.envOr("OUTPUT_JSON", DEFAULT_OUTPUT_JSON);
        string memory memo = vm.envOr("MEMO", string("Re-opening Launchpad funding"));

        require(hook != address(0), "REOPEN_PAY_HOOK_ADDRESS required");
        require(deadlineTs > 0, "DEADLINE_TIMESTAMP required");
        require(seedBatchSize > 0, "SEED_BATCH_SIZE must be > 0");
        require(tokensPerEth > 0 && tokensPerEth <= 1_000_000_000, "TOKENS_PER_ETH out of range");

        uint256 reopenWeight = tokensPerEth * 2 * 1e18;

        console.log("=== Frank re-open Safe batch ===");
        console.log("Safe (project owner):", safe);
        console.log("Project ID:", projectId);
        console.log("ReopenPayHook:", hook);
        console.log("Contributor rate (tokens/ETH):", tokensPerEth);
        console.log("New deadline (unix):", deadlineTs);
        console.log("JB Controller:", JB_V5_CONTROLLER);
        console.log("");

        (address[] memory holders, uint256[] memory eths, uint256[] memory toks) =
            _loadContributions(contributionsJson);

        // Sanity: seeded ETH should sum to the recorded pot (helps catch a wrong JSON).
        uint256 sumEth;
        for (uint256 i = 0; i < eths.length; i++) sumEth += eths[i];
        console.log("Backers to seed:", holders.length);
        console.log("Sum of seeded ETH (wei):", sumEth);
        console.log("");

        string memory txsJson = "";
        uint256 txCount;

        // 1. seedContributions batches.
        for (uint256 start = 0; start < holders.length; start += seedBatchSize) {
            uint256 end = start + seedBatchSize;
            if (end > holders.length) end = holders.length;
            uint256 len = end - start;
            address[] memory bH = new address[](len);
            uint256[] memory bE = new uint256[](len);
            uint256[] memory bT = new uint256[](len);
            for (uint256 i = 0; i < len; i++) {
                bH[i] = holders[start + i];
                bE[i] = eths[start + i];
                bT[i] = toks[start + i];
            }
            bytes memory data = abi.encodeWithSelector(
                ReopenPayHook.seedContributions.selector, bH, bE, bT
            );
            console.log(string.concat("[tx ", vm.toString(txCount), "] seedContributions batch (", vm.toString(len), " backers)"));
            console.log("  To:", hook);
            console.log("  Data:");
            console.logBytes(data);
            txsJson = _appendTx(txsJson, txCount, hook, data);
            txCount++;
        }

        // 2. lockLedger.
        bytes memory lockData = abi.encodeWithSelector(ReopenPayHook.lockLedger.selector);
        console.log(string.concat("[tx ", vm.toString(txCount), "] lockLedger()"));
        console.log("  To:", hook);
        console.log("  Data:");
        console.logBytes(lockData);
        txsJson = _appendTx(txsJson, txCount, hook, lockData);
        txCount++;

        // 3. queueRulesetsOf.
        JBRulesetConfig[] memory config = _buildReopenRulesetConfig(
            hook, terminalAddress, reopenWeight, moonDAOTreasury, teamVesting, moonDAOVesting, poolDeployer, safe
        );
        bytes memory queueData = abi.encodeWithSelector(
            IJBController.queueRulesetsOf.selector, projectId, config, memo
        );
        console.log(string.concat("[tx ", vm.toString(txCount), "] queueRulesetsOf(projectId, config, memo)"));
        console.log("  To (JB Controller):", JB_V5_CONTROLLER);
        console.log("  Data:");
        console.logBytes(queueData);
        txsJson = _appendTx(txsJson, txCount, JB_V5_CONTROLLER, queueData);
        txCount++;

        // 4. setDeadline.
        bytes memory deadlineData = abi.encodeWithSelector(ReopenPayHook.setDeadline.selector, deadlineTs);
        console.log(string.concat("[tx ", vm.toString(txCount), "] setDeadline(", vm.toString(deadlineTs), ")"));
        console.log("  To:", hook);
        console.log("  Data:");
        console.logBytes(deadlineData);
        txsJson = _appendTx(txsJson, txCount, hook, deadlineData);
        txCount++;

        // Write the Safe Transaction Builder JSON.
        string memory json = string.concat(
            "{\"version\":\"1.0\",",
            "\"chainId\":\"", vm.toString(chainId), "\",",
            "\"createdAt\":", vm.toString(block.timestamp * 1000), ",",
            "\"meta\":{\"name\":\"Frank re-open go-live\",",
            "\"description\":\"seedContributions + lockLedger + queueRulesetsOf + setDeadline\",",
            "\"txBuilderVersion\":\"1.16.5\",",
            "\"createdFromSafeAddress\":\"", vm.toString(safe), "\"},",
            "\"transactions\":[", txsJson, "]}"
        );
        vm.writeFile(outputJson, json);

        console.log("");
        console.log("=== DONE ===");
        console.log("Transactions in batch:", txCount);
        console.log("Safe Transaction Builder JSON written to:", outputJson);
        console.log("Import it in Safe -> Apps -> Transaction Builder -> Load, then review + execute.");
    }

    /// @dev Builds one Transaction Builder tx object and appends it (comma-separated).
    function _appendTx(string memory acc, uint256 index, address to, bytes memory data)
        internal
        pure
        returns (string memory)
    {
        string memory obj = string.concat(
            "{\"to\":\"", vm.toString(to), "\",",
            "\"value\":\"0\",",
            "\"data\":\"", vm.toString(data), "\",",
            "\"contractMethod\":null,\"contractInputsValues\":null}"
        );
        return index == 0 ? obj : string.concat(acc, ",", obj);
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

    /// @dev Mirrors QueueReopenRuleset / SetupReopenOnFork: 50% reserved, identical
    ///      split beneficiaries, no payout limits, owner-only surplus allowance.
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
