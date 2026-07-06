// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import {IJBRulesetDataHook} from "@nana-core-v5/interfaces/IJBRulesetDataHook.sol";
import {IJBPayHook} from "@nana-core-v5/interfaces/IJBPayHook.sol";
import {IJBCashOutHook} from "@nana-core-v5/interfaces/IJBCashOutHook.sol";
import {IJBRulesets} from "@nana-core-v5/interfaces/IJBRulesets.sol";
import {IJBTerminalStore} from "@nana-core-v5/interfaces/IJBTerminalStore.sol";
import {IJBController} from "@nana-core-v5/interfaces/IJBController.sol";
import {IJBTokens} from "@nana-core-v5/interfaces/IJBTokens.sol";
import {IJBTerminal} from "@nana-core-v5/interfaces/IJBTerminal.sol";

import {JBRuleset} from "@nana-core-v5/structs/JBRuleset.sol";
import {JBBeforePayRecordedContext} from "@nana-core-v5/structs/JBBeforePayRecordedContext.sol";
import {JBAfterPayRecordedContext} from "@nana-core-v5/structs/JBAfterPayRecordedContext.sol";
import {JBBeforeCashOutRecordedContext} from "@nana-core-v5/structs/JBBeforeCashOutRecordedContext.sol";
import {JBAfterCashOutRecordedContext} from "@nana-core-v5/structs/JBAfterCashOutRecordedContext.sol";
import {JBPayHookSpecification} from "@nana-core-v5/structs/JBPayHookSpecification.sol";
import {JBCashOutHookSpecification} from "@nana-core-v5/structs/JBCashOutHookSpecification.sol";
import {JBConstants} from "@nana-core-v5/libraries/JBConstants.sol";

import {IDePrizeRegistry} from "./deprize/IDePrizeRegistry.sol";

// ReopenPayHook
//
//   Successor to LaunchPadPayHook for RE-OPENED missions, where token holders who
//   minted at different issuance rates coexist (e.g. the original 1,000/ETH backers
//   and 500/ETH re-open backers of the same project).
//
//   REFUND MODEL: exact ETH back ("deposit ledger").
//
//   The problem with pro-rata refunds across mixed rates: if the pot were split by
//   tokens held, a 1,000/ETH backer and a 500/ETH backer who each paid 1 ETH would
//   NOT each get 1 ETH back — the higher-rate backer holds more tokens and would
//   reclaim more than they put in, the lower-rate backer less. That is unfair and
//   confusing.
//
//   Instead this hook records how much ETH each address actually contributed and
//   returns exactly that on refund, regardless of the rate they minted at:
//
//     - beforePayRecordedWith attaches this contract as a pay hook (0 ETH forwarded).
//     - afterPayRecordedWith (terminal-only) credits ethContributed[beneficiary].
//     - On refund, beforeCashOutRecordedWith returns a synthetic `totalSupply` so the
//       terminal's reclaim formula (surplus * cashOutCount / totalSupply, tax 0)
//       resolves to exactly the caller's remaining ETH, scaled by the fraction of
//       their tokens being burned.
//     - afterCashOutRecordedWith (terminal-only) decrements ethContributed by the
//       reclaimed amount so partial refunds and re-refunds stay exact.
//
//   Original (pre-hook) contributions are seeded once via seedContributions(): at
//   re-open time every non-reserved holder minted at exactly 1,000/ETH, so their
//   contribution is balance / 1000. Seeding must complete before the re-open ruleset
//   goes live; call lockLedger() afterwards to freeze the seed.
//
//   The sum of ethContributed equals the ETH in the terminal, so refunds are
//   order-independent and the pot clears exactly (minus integer-division dust, which
//   is rounded in the pot's favor). Reserved-token allocation holders (vesting
//   contracts, pool deployer) never paid ETH — they hold ethContributed == 0 and are
//   additionally blocked from cashing out.
//
//   CAVEAT: the ledger keys off ETH paid, not tokens currently held. If a holder
//   transfers project tokens after re-open, their refund claim does not move with the
//   tokens. Re-open rulesets should set pauseCreditTransfers = true to prevent this;
//   these tokens are contribution receipts, not actively traded during a raise.
//
//   Everything else (funding kill-switch, goal/deadline gating, refund window,
//   stage(), optional DePrize registry latch) matches LaunchPadPayHook.
contract ReopenPayHook is IJBRulesetDataHook, IJBPayHook, IJBCashOutHook, Ownable {

    uint256 public immutable fundingGoal;
    uint256 public deadline;
    uint256 public immutable refundPeriod;

    bool public fundingTurnedOff;
    bool public refundsEnabled;

    IJBTerminalStore public jbTerminalStore;
    IJBRulesets public jbRulesets;
    IJBController public jbController;
    IJBTokens public jbTokens;

    /// @notice ETH contributed per address, in wei. Credited on pay, decremented on
    ///         cash out, and seeded once for the original (pre-hook) raise.
    mapping(address => uint256) public ethContributed;

    /// @notice Once locked, seedContributions can no longer be called. Set this after
    ///         seeding the original raise and before the re-open ruleset goes live.
    bool public ledgerLocked;

    /// @notice Holders of reserved-token allocations (vesting contracts, pool
    ///         deployer). They never contributed ETH and cannot cash out.
    address[] public reservedHolders;

    /// @notice Optional DePrize source of truth. When unset, the hook behaves
    ///         exactly as the original (non-DePrize) hook.
    IDePrizeRegistry public deprizeRegistry;

    event DePrizeRegistrySet(address indexed registry);
    event ContributionSeeded(address indexed holder, uint256 amount);
    event LedgerLocked();

    error DePrizeRegistryAlreadySet();

    constructor(
        uint256 _fundingGoal,
        uint256 _deadline,
        uint256 _refundPeriod,
        address _jbTerminalStoreAddress,
        address _jbRulesetAddress,
        address _jbControllerAddress,
        address _jbTokensAddress,
        address[] memory _reservedHolders,
        address owner
    ) Ownable(owner) {
        fundingGoal = _fundingGoal;
        deadline = _deadline;
        refundPeriod = _refundPeriod;
        jbTerminalStore = IJBTerminalStore(_jbTerminalStoreAddress);
        jbRulesets = IJBRulesets(_jbRulesetAddress);
        jbController = IJBController(_jbControllerAddress);
        jbTokens = IJBTokens(_jbTokensAddress);
        for (uint256 i = 0; i < _reservedHolders.length; i++) {
            require(_reservedHolders[i] != address(0), "reserved holder is zero");
            for (uint256 j = 0; j < reservedHolders.length; j++) {
                require(reservedHolders[j] != _reservedHolders[i], "duplicate reserved holder");
            }
            reservedHolders.push(_reservedHolders[i]);
        }
    }

    // ---------------------------------------------------------------------------
    // Owner configuration
    // ---------------------------------------------------------------------------

    function setFundingTurnedOff(bool _fundingTurnedOff) external onlyOwner {
        fundingTurnedOff = _fundingTurnedOff;
    }

    function enableRefunds(bool _refundsEnabled) external onlyOwner {
        refundsEnabled = _refundsEnabled;
    }

    /// @notice Update the campaign deadline. Use this to reset the countdown from
    ///         the actual ruleset go-live date when hook deployment and ruleset
    ///         activation happen in separate transactions (e.g. deploy via EOA then
    ///         queue via a Safe). Must be called before the campaign starts
    ///         accepting contributions (i.e. before the new ruleset is active).
    function setDeadline(uint256 _deadline) external onlyOwner {
        require(_deadline > block.timestamp, "Deadline must be in the future.");
        deadline = _deadline;
    }

    /// @notice Seed the deposit ledger with the original (pre-hook) contributions.
    ///         For a re-opened mission this is balance / 1000 for each non-reserved
    ///         holder (they all minted at 1,000/ETH). Values are SET, not added, so
    ///         seeding is idempotent; it must run before any new contribution to avoid
    ///         clobbering live credits. Reserved holders must be excluded.
    /// @param holders The contributor addresses to seed.
    /// @param amounts The ETH each contributed, in wei.
    function seedContributions(address[] calldata holders, uint256[] calldata amounts) external onlyOwner {
        require(!ledgerLocked, "Ledger is locked.");
        require(holders.length == amounts.length, "Length mismatch.");
        for (uint256 i = 0; i < holders.length; i++) {
            require(!isReservedHolder(holders[i]), "Cannot seed a reserved holder.");
            ethContributed[holders[i]] = amounts[i];
            emit ContributionSeeded(holders[i], amounts[i]);
        }
    }

    /// @notice Freeze the seed so it can no longer be edited. Call after seeding and
    ///         before the re-open ruleset goes live.
    function lockLedger() external onlyOwner {
        ledgerLocked = true;
        emit LedgerLocked();
    }

    /// @notice Attach the DePrize registry. Owner-gated and write-once, same
    ///         rationale as LaunchPadPayHook.setDePrizeRegistry.
    function setDePrizeRegistry(address _registry) external onlyOwner {
        if (address(deprizeRegistry) != address(0)) revert DePrizeRegistryAlreadySet();
        require(_registry != address(0), "registry is zero");
        deprizeRegistry = IDePrizeRegistry(_registry);
        emit DePrizeRegistrySet(_registry);
    }

    // ---------------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------------

    function isReservedHolder(address holder) public view returns (bool) {
        for (uint256 i = 0; i < reservedHolders.length; i++) {
            if (reservedHolders[i] == holder) return true;
        }
        return false;
    }

    function _deprizeIdFor(uint256 projectId) internal view returns (uint256) {
        if (address(deprizeRegistry) == address(0)) return 0;
        return deprizeRegistry.deprizeIdByJBProject(projectId);
    }

    function _totalFunding(address terminal, uint256 projectId) internal view returns (uint256) {
        uint256 balance = jbTerminalStore.balanceOf(
            terminal,
            projectId,
            JBConstants.NATIVE_TOKEN
        );
        uint256 withdrawn = jbTerminalStore.usedPayoutLimitOf(
          address(terminal),
          projectId,
          JBConstants.NATIVE_TOKEN,
          2, // payout cycle
          uint32(uint160(JBConstants.NATIVE_TOKEN))
        );
        return balance + withdrawn;
    }

    /// @dev Only the project's registered terminal may drive the ledger.
    function _requireTerminal(uint256 projectId) internal view {
        require(
            jbController.DIRECTORY().isTerminalOf(projectId, IJBTerminal(msg.sender)),
            "Caller is not the project terminal."
        );
    }

    // ---------------------------------------------------------------------------
    // Data hook: pay
    // ---------------------------------------------------------------------------

    function beforePayRecordedWith(JBBeforePayRecordedContext calldata context)
        external
        view
        override
        returns (uint256 weight, JBPayHookSpecification[] memory hookSpecifications)
    {
        if (fundingTurnedOff) {
            revert("Funding has been turned off.");
        }
        require(context.amount.token == JBConstants.NATIVE_TOKEN);

        // Record every contribution in the deposit ledger (0 ETH forwarded to the
        // hook — the payment stays in the terminal and tokens mint as normal).
        hookSpecifications = new JBPayHookSpecification[](1);
        hookSpecifications[0] = JBPayHookSpecification({
            hook: IJBPayHook(address(this)),
            amount: 0,
            metadata: bytes("")
        });

        uint256 deprizeId = _deprizeIdFor(context.projectId);
        if (deprizeId != 0) {
            if (deprizeRegistry.isTerminal(deprizeId)) {
                revert("DePrize is closed to new contributions.");
            }
            return (context.weight, hookSpecifications);
        }

        uint256 currentFunding = _totalFunding(context.terminal, context.projectId);
        if (currentFunding < fundingGoal && block.timestamp >= deadline) {
            revert("Project funding deadline has passed and funding goal requirement has not been met.");
        }
        weight = context.weight;
    }

    function afterPayRecordedWith(JBAfterPayRecordedContext calldata context) external payable override {
        _requireTerminal(context.projectId);
        // No ETH should be forwarded to the hook; the contribution stays in the terminal.
        require(msg.value == 0, "Unexpected value forwarded.");
        if (context.amount.value > 0) {
            ethContributed[context.beneficiary] += context.amount.value;
        }
    }

    // ---------------------------------------------------------------------------
    // Data hook: cash out (refund)
    // ---------------------------------------------------------------------------

    function beforeCashOutRecordedWith(JBBeforeCashOutRecordedContext calldata context) external view override
        returns (
        uint256 cashOutTaxRate,
        uint256 cashOutCount,
        uint256 totalSupply,
        JBCashOutHookSpecification[] memory hookSpecifications
    ){
        // Reserved-token allocations never contributed ETH.
        if (isReservedHolder(context.holder)) {
            revert("Reserved token allocations cannot cash out.");
        }

        uint256 deprizeId = _deprizeIdFor(context.projectId);
        if (deprizeId != 0) {
            if (!deprizeRegistry.isRefundable(deprizeId)) {
                revert("DePrize is active. Refunds are disabled.");
            }
        } else {
            uint256 currentFunding = _totalFunding(context.terminal, context.projectId);
            if (!refundsEnabled && currentFunding >= fundingGoal) {
                revert("Project has passed funding goal requirement. Refunds are disabled.");
            }
            if (block.timestamp < deadline) {
                revert("Project funding deadline has not passed. Refunds are disabled.");
            }
            if (block.timestamp >= deadline + refundPeriod) {
                revert("Refund period has passed. Refunds are disabled.");
            }
        }

        // Refund the caller EXACTLY the ETH they contributed, scaled by the fraction
        // of their tokens being burned — independent of the rate they minted at.
        //
        // The terminal computes reclaim = surplus * cashOutCount / totalSupply (tax 0).
        // Return a synthetic totalSupply so that resolves to:
        //   reclaim = cashOutCount * ethContributed[holder] / balance[holder]
        uint256 contributed = ethContributed[context.holder];
        require(contributed > 0, "No refundable contribution recorded for this holder.");

        uint256 balance = jbTokens.totalBalanceOf(context.holder, context.projectId);
        require(balance > 0, "Holder has no project tokens.");

        cashOutCount = context.cashOutCount;
        // Ceil-divide so any dust rounds in the pot's favor (never over-draws).
        uint256 numerator = context.surplus.value * balance;
        totalSupply = (numerator + contributed - 1) / contributed;

        hookSpecifications = new JBCashOutHookSpecification[](1);
        hookSpecifications[0] = JBCashOutHookSpecification({
            hook: IJBCashOutHook(address(this)),
            amount: 0,
            metadata: bytes("")
        });
    }

    function afterCashOutRecordedWith(JBAfterCashOutRecordedContext calldata context) external payable override {
        _requireTerminal(context.projectId);
        uint256 reclaimed = context.reclaimedAmount.value;
        uint256 contributed = ethContributed[context.holder];
        // Decrement the ledger by the refunded amount, preserving the
        // ethContributed / balance ratio for any remaining tokens.
        ethContributed[context.holder] = reclaimed >= contributed ? 0 : contributed - reclaimed;
    }

    // ---------------------------------------------------------------------------
    // Boilerplate
    // ---------------------------------------------------------------------------

    function hasMintPermissionFor(uint256 projectId, JBRuleset memory ruleset, address addr) external view override returns (bool flag){
        return false;
    }

    /// @notice ERC165 support for the data hook and the pay/cash-out hooks.
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IJBRulesetDataHook).interfaceId
            || interfaceId == type(IJBPayHook).interfaceId
            || interfaceId == type(IJBCashOutHook).interfaceId
            || interfaceId == type(IERC165).interfaceId;
    }

    // return a stage number based on what tier the project is in.
    function stage(address terminal, uint256 projectId) public view returns (uint256) {
        uint256 deprizeId = _deprizeIdFor(projectId);
        if (deprizeId != 0) {
            if (deprizeRegistry.isRefundable(deprizeId)) {
                return 3; // Refund stage
            }
            return 1; // Active campaign — cashOut disabled
        }

        uint256 currentFunding = _totalFunding(terminal, projectId);
        if (currentFunding < fundingGoal || refundsEnabled) {
            if (block.timestamp >= deadline) {
                if (block.timestamp < deadline + refundPeriod) {
                    return 3; // Refund stage
                } else {
                    return 4; // Refund stage passed
                }
            } else {
                return 1; // Stage 1
            }
        } else {
            return 2; // Stage 2
        }
    }
}
