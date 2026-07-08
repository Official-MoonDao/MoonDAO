// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "std/Test.sol";
import "base/Config.sol";

import {ReopenPayHook} from "../src/ReopenPayHook.sol";

import {IJBController} from "@nana-core-v5/interfaces/IJBController.sol";
import {IJBProjects} from "@nana-core-v5/interfaces/IJBProjects.sol";
import {IJBRulesets} from "@nana-core-v5/interfaces/IJBRulesets.sol";
import {IJBTerminalStore} from "@nana-core-v5/interfaces/IJBTerminalStore.sol";
import {IJBTokens} from "@nana-core-v5/interfaces/IJBTokens.sol";
import {IJBMultiTerminal} from "@nana-core-v5/interfaces/IJBMultiTerminal.sol";
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

/// @title ReopenFrankArbitrumDryRun
/// @notice Track A of the Frank re-open rollout plan: a full, assertion-backed dry
///         run of the re-open sequence executed against a FORK of live Arbitrum,
///         driving the REAL "Send Frank to Space" project (id 73) with its REAL
///         contributor set (script/backfill/frank-contributions.json) and its REAL
///         owner Safe (impersonated).
///
/// Unlike ReopenRulesetTest.t.sol — which builds a synthetic mission from scratch to
/// prove the hook's math — this harness proves the sequence works against the exact
/// on-chain state we will touch in production:
///   1. Reproduce today's state: project 73 is closed below goal, funds still parked.
///   2. Deploy ReopenPayHook (owned by the real team Safe).
///   3. Seed the deposit ledger with every original backer, then lock it.
///   4. Queue the re-open ruleset from the Safe and reset the deadline.
///   5. Assert the re-open ruleset is live at the new rate, new money mints at
///      500/ETH, original balances are untouched, and — after the new deadline —
///      both a new backer and a real original backer get their exact ETH back.
///   6. Assert the "one-way door" guard: a non-owner cannot drain the surplus.
///
/// HOW TO RUN (needs an archive-capable Arbitrum RPC):
///   export ARBITRUM_RPC_URL=https://arb-mainnet.g.alchemy.com/v2/<key>
///   forge test --match-contract ReopenFrankArbitrumDryRun -vvv \
///     --fork-url $ARBITRUM_RPC_URL
///
///   Or use the convenience runner: script/dry-run-reopen-arbitrum.sh
///
/// The harness auto-forks when ARBITRUM_RPC_URL (or ARB_RPC_URL) is set, so it can
/// also be run without --fork-url. If no fork is configured it skips gracefully.
///
/// Every parameter has a Frank default but is env-overridable so the same harness
/// works for other re-opened missions:
///   PROJECT_ID, TERMINAL, TEAM_VESTING, MOONDAO_VESTING, POOL_DEPLOYER,
///   MOONDAO_TREASURY, FUNDING_GOAL, TOKENS_PER_ETH, CAMPAIGN_DURATION_DAYS,
///   REFUND_PERIOD_DAYS, CONTRIBUTIONS_JSON.
contract ReopenFrankArbitrumDryRun is Test, Config {
    // --- Frank "Send Frank to Space" defaults (mission id 4 / project 73) --------
    // Confirmed from the original mission-creation tx
    // (0xb674a3df953b583b3ba6bc06f8c282e3344d560a96e6d8de7a7effc44e5824c1).
    uint256 constant DEFAULT_PROJECT_ID = 73;
    address constant DEFAULT_TEAM_VESTING = 0x02430cC8e6932850a08D0c8820437A3229D8D6eb;
    address constant DEFAULT_MOONDAO_VESTING = 0x2f696B8102cE1214F7DfFFE4F3c99684e13Fc5b8;
    address constant DEFAULT_POOL_DEPLOYER = 0x95Fc39Dd278B8dCD7B0219d6E109717d8e539114;
    address constant DEFAULT_MOONDAO_TREASURY = 0xAF26a002d716508b7e375f1f620338442F5470c0; // Arbitrum
    string constant DEFAULT_CONTRIBUTIONS_JSON = "script/backfill/frank-contributions.json";

    // Frank's goal is far above the ~26.7 ETH raised, so the mission stays below goal
    // (its true state). Only needs to exceed total funding for the dry run.
    uint256 constant DEFAULT_FUNDING_GOAL = 2154 ether;
    uint256 constant DEFAULT_TOKENS_PER_ETH = 500;
    uint256 constant DEFAULT_CAMPAIGN_DURATION_DAYS = 548;
    uint256 constant DEFAULT_REFUND_PERIOD_DAYS = 28;

    // Resolved config
    uint256 projectId;
    address terminalAddress;
    address teamVesting;
    address moonDAOVesting;
    address poolDeployer;
    address moonDAOTreasury;
    uint256 fundingGoal;
    uint256 tokensPerEth;
    uint256 campaignDuration;
    uint256 refundPeriod;
    uint256 reopenWeight;
    string contributionsJson;

    IJBController jbController;
    IJBProjects jbProjects;
    IJBRulesets jbRulesets;
    IJBTerminalStore jbTerminalStore;
    IJBTokens jbTokens;
    IJBMultiTerminal terminal;

    address projectOwner;
    bool forkReady;

    address constant NEW_BACKER = address(0xF00DBABE);

    function setUp() public {
        // Auto-fork when an Arbitrum RPC is provided; otherwise rely on --fork-url.
        string memory rpc = vm.envOr("ARBITRUM_RPC_URL", string(""));
        if (bytes(rpc).length == 0) rpc = vm.envOr("ARB_RPC_URL", string(""));
        if (bytes(rpc).length != 0) {
            uint256 forkBlock = vm.envOr("FORK_BLOCK", uint256(0));
            if (forkBlock != 0) {
                vm.createSelectFork(rpc, forkBlock);
            } else {
                // Preserve a fork already selected via CLI (e.g. --fork-url with
                // --fork-block-number). Foundry does not surface the CLI's pinned
                // block through env vars, so re-forking here would silently move
                // a pinned run to chain head and break reproducibility.
                try vm.activeFork() returns (uint256) {
                    // Already on a fork; leave it alone.
                } catch {
                    vm.createSelectFork(rpc);
                }
            }
        }

        // Only run the on-chain flow if we are actually on a fork of Juicebox v5.
        forkReady = JB_V5_CONTROLLER.code.length > 0 && JB_V5_MULTI_TERMINAL.code.length > 0;

        projectId = vm.envOr("PROJECT_ID", DEFAULT_PROJECT_ID);
        terminalAddress = vm.envOr("TERMINAL", JB_V5_MULTI_TERMINAL);
        teamVesting = vm.envOr("TEAM_VESTING", DEFAULT_TEAM_VESTING);
        moonDAOVesting = vm.envOr("MOONDAO_VESTING", DEFAULT_MOONDAO_VESTING);
        poolDeployer = vm.envOr("POOL_DEPLOYER", DEFAULT_POOL_DEPLOYER);
        moonDAOTreasury = vm.envOr("MOONDAO_TREASURY", DEFAULT_MOONDAO_TREASURY);
        fundingGoal = vm.envOr("FUNDING_GOAL", DEFAULT_FUNDING_GOAL);
        tokensPerEth = vm.envOr("TOKENS_PER_ETH", DEFAULT_TOKENS_PER_ETH);
        campaignDuration = vm.envOr("CAMPAIGN_DURATION_DAYS", DEFAULT_CAMPAIGN_DURATION_DAYS) * 1 days;
        refundPeriod = vm.envOr("REFUND_PERIOD_DAYS", DEFAULT_REFUND_PERIOD_DAYS) * 1 days;
        contributionsJson = vm.envOr("CONTRIBUTIONS_JSON", DEFAULT_CONTRIBUTIONS_JSON);

        // 50% reserved -> ruleset weight is double the contributor rate.
        reopenWeight = tokensPerEth * 2 * 1e18;

        jbController = IJBController(JB_V5_CONTROLLER);
        jbProjects = IJBProjects(JB_V5_PROJECTS);
        jbRulesets = IJBRulesets(JB_V5_RULESETS);
        jbTerminalStore = IJBTerminalStore(JB_V5_TERMINAL_STORE);
        jbTokens = IJBTokens(JB_V5_TOKENS);
        terminal = IJBMultiTerminal(terminalAddress);
    }

    /// @notice The full production sequence, end to end, with assertions.
    function testDryRunReopenAgainstArbitrum() public {
        if (!forkReady) {
            emit log("SKIP: no Arbitrum fork. Set ARBITRUM_RPC_URL or pass --fork-url.");
            return;
        }

        projectOwner = jbProjects.ownerOf(projectId);
        require(projectOwner != address(0), "Project owner not found on fork");

        // --- Step 1: reproduce today's state -----------------------------------
        uint256 potBefore = jbTerminalStore.balanceOf(terminalAddress, projectId, JBConstants.NATIVE_TOKEN);
        emit log_named_address("Project owner (Safe)", projectOwner);
        emit log_named_uint("Terminal balance before (wei)", potBefore);
        assertGt(potBefore, 0, "Expected the real raise to still be parked in the terminal");
        assertLt(potBefore, fundingGoal, "Mission should be below goal (its real state)");

        // --- Step 2: deploy the re-open pay hook (owned by the Safe) ------------
        address[] memory reservedHolders = new address[](3);
        reservedHolders[0] = teamVesting;
        reservedHolders[1] = moonDAOVesting;
        reservedHolders[2] = poolDeployer;

        vm.startPrank(projectOwner);
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
        emit log_named_address("Deployed ReopenPayHook", address(hook));

        // --- Step 3: seed every original backer, then lock the ledger ----------
        (address[] memory holders, uint256[] memory eths, uint256[] memory toks) = _loadContributions();
        hook.seedContributions(holders, eths, toks);
        hook.lockLedger();
        emit log_named_uint("Seeded original backers", holders.length);

        // --- Step 4: queue the re-open ruleset and reset the deadline ----------
        JBRulesetConfig[] memory config = _buildReopenRulesetConfig(address(hook), terminalAddress, reopenWeight);
        jbController.queueRulesetsOf(projectId, config, "Frank re-open dry run");
        hook.setDeadline(block.timestamp + campaignDuration);
        vm.stopPrank();

        // --- Step 5a: the re-open ruleset is live at the new rate --------------
        // Nudge past any approval delay carried by the currently-active ruleset.
        skip(1);
        JBRuleset memory active = jbRulesets.currentOf(projectId);
        assertEq(uint256(active.weight), reopenWeight, "Active weight must equal the re-open rate");
        assertEq(uint256(active.weightCutPercent), 0, "No automatic decay");
        assertEq(address(active.approvalHook), address(0), "No approval hook on re-open ruleset");
        assertEq(uint256(active.duration), 0, "Ruleset lasts until the next one is queued");
        assertEq(hook.stage(terminalAddress, projectId), 1, "Mission should be active again");

        // --- Step 5b: new money mints at the new rate; originals untouched -----
        address sampleOriginal = _firstSeededHolder(holders);
        uint256 sampleBalBefore = jbTokens.totalBalanceOf(sampleOriginal, projectId);

        vm.deal(NEW_BACKER, 10 ether);
        vm.prank(NEW_BACKER);
        terminal.pay{value: 1 ether}(projectId, JBConstants.NATIVE_TOKEN, 0, NEW_BACKER, 0, "", new bytes(0));
        assertEq(
            jbTokens.totalBalanceOf(NEW_BACKER, projectId),
            tokensPerEth * 1e18,
            "New backer must mint at the re-open rate"
        );
        assertEq(
            jbTokens.totalBalanceOf(sampleOriginal, projectId),
            sampleBalBefore,
            "Original backer balance must not change"
        );
        assertEq(hook.ethContributed(NEW_BACKER), 1 ether, "Live contribution recorded in the ledger");

        // --- Step 5c: after the new deadline, exact refunds for everyone -------
        skip(campaignDuration + 1);
        assertEq(hook.stage(terminalAddress, projectId), 3, "Should be in the refund window");

        // New backer gets exactly the 1 ETH they put in.
        uint256 nbBefore = NEW_BACKER.balance;
        vm.prank(NEW_BACKER);
        uint256 nbRefund = terminal.cashOutTokensOf(
            NEW_BACKER, projectId, tokensPerEth * 1e18, JBConstants.NATIVE_TOKEN, 0, payable(NEW_BACKER), bytes("")
        );
        assertEq(nbRefund, 1 ether, "New backer refunded exactly their contribution");
        assertEq(NEW_BACKER.balance - nbBefore, 1 ether, "New backer received exactly 1 ETH");

        // A real original backer (still holding their tokens) gets their exact ETH.
        (address realBacker, uint256 realEth, uint256 realTokens) = _findRefundableHolder(holders, eths, toks);
        emit log_named_address("Refund-tested original backer", realBacker);
        emit log_named_uint("Their recorded ETH (wei)", realEth);
        uint256 rbBefore = realBacker.balance;
        vm.prank(realBacker);
        uint256 rbRefund = terminal.cashOutTokensOf(
            realBacker, projectId, realTokens, JBConstants.NATIVE_TOKEN, 0, payable(realBacker), bytes("")
        );
        // Ceil-div in the hook rounds dust in the pot's favor: refund <= contribution.
        assertApproxEqAbs(rbRefund, realEth, 1000, "Original backer refunded their exact ETH (dust tolerance)");
        assertLe(rbRefund, realEth, "Refund never exceeds the recorded contribution");
        assertEq(realBacker.balance - rbBefore, rbRefund, "Backer received the reclaimed ETH");
    }

    /// @notice "One-way door" guard: while the re-open ruleset is live, a non-owner
    ///         cannot pull funds out of the surplus, so contributions stay refundable.
    function testDryRunSurplusCannotBeDrainedByNonOwner() public {
        if (!forkReady) {
            emit log("SKIP: no Arbitrum fork. Set ARBITRUM_RPC_URL or pass --fork-url.");
            return;
        }

        projectOwner = jbProjects.ownerOf(projectId);

        address[] memory reservedHolders = new address[](3);
        reservedHolders[0] = teamVesting;
        reservedHolders[1] = moonDAOVesting;
        reservedHolders[2] = poolDeployer;

        vm.startPrank(projectOwner);
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
        JBRulesetConfig[] memory config = _buildReopenRulesetConfig(address(hook), terminalAddress, reopenWeight);
        jbController.queueRulesetsOf(projectId, config, "Frank re-open dry run (surplus guard)");
        hook.setDeadline(block.timestamp + campaignDuration);
        vm.stopPrank();
        skip(1);

        address attacker = address(0xBAD);
        vm.prank(attacker);
        vm.expectRevert();
        terminal.useAllowanceOf(
            projectId,
            JBConstants.NATIVE_TOKEN,
            1 ether,
            uint32(uint160(JBConstants.NATIVE_TOKEN)),
            0,
            payable(attacker),
            payable(attacker),
            "attacker surplus"
        );

        // Payouts are locked too: the re-open ruleset has no payout limit.
        vm.prank(attacker);
        vm.expectRevert();
        terminal.sendPayoutsOf(projectId, JBConstants.NATIVE_TOKEN, 1 ether, uint32(uint160(JBConstants.NATIVE_TOKEN)), 0);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /// @dev Loads the backfilled contribution ledger. Amounts are stored as decimal
    ///      strings (they exceed JSON's safe-integer range), so parse them as strings.
    function _loadContributions()
        internal
        returns (address[] memory holders, uint256[] memory eths, uint256[] memory toks)
    {
        string memory json = vm.readFile(contributionsJson);
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

    function _firstSeededHolder(address[] memory holders) internal view returns (address) {
        for (uint256 i = 0; i < holders.length; i++) {
            if (holders[i] != teamVesting && holders[i] != moonDAOVesting && holders[i] != poolDeployer) {
                return holders[i];
            }
        }
        revert("No non-reserved holder to sample");
    }

    /// @dev Finds a real backer that still holds at least their recorded backing
    ///      tokens on-chain, so a full-balance cash-out proves the exact refund.
    ///      Prefers the largest such contribution to make the refund unambiguous.
    function _findRefundableHolder(
        address[] memory holders,
        uint256[] memory eths,
        uint256[] memory toks
    ) internal view returns (address holder, uint256 eth, uint256 tokens) {
        uint256 bestEth;
        for (uint256 i = 0; i < holders.length; i++) {
            if (holders[i] == teamVesting || holders[i] == moonDAOVesting || holders[i] == poolDeployer) continue;
            uint256 liveBalance = jbTokens.totalBalanceOf(holders[i], projectId);
            if (liveBalance >= toks[i] && toks[i] > 0 && eths[i] > bestEth) {
                bestEth = eths[i];
                holder = holders[i];
                eth = eths[i];
                tokens = toks[i];
            }
        }
        require(holder != address(0), "No original backer still holds their recorded tokens on the fork");
    }

    /// @dev Mirrors QueueReopenRuleset.s.sol / ReopenRulesetTest exactly: 50% reserved,
    ///      original split beneficiaries, no payout limits (payouts locked), same
    ///      surplus allowance, no approval hook, no decay.
    function _buildReopenRulesetConfig(address payHook, address terminal_, uint256 weight)
        internal
        view
        returns (JBRulesetConfig[] memory)
    {
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
            beneficiary: payable(projectOwner),
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
            terminal: terminal_,
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
