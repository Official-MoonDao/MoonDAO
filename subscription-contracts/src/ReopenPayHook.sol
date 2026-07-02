// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {JBPayHookSpecification} from "@nana-core-v5/structs/JBPayHookSpecification.sol";
import {IJBRulesets} from "@nana-core-v5/interfaces/IJBRulesets.sol";
import {JBRuleset} from "@nana-core-v5/structs/JBRuleset.sol";

import {JBBeforePayRecordedContext} from "@nana-core-v5/structs/JBBeforePayRecordedContext.sol";
import {JBBeforeCashOutRecordedContext} from "@nana-core-v5/structs/JBBeforeCashOutRecordedContext.sol";
import {JBCashOutHookSpecification} from "@nana-core-v5/structs/JBCashOutHookSpecification.sol";
import {IJBTerminalStore} from "@nana-core-v5/interfaces/IJBTerminalStore.sol";
import {IJBRulesetDataHook} from "@nana-core-v5/interfaces/IJBRulesetDataHook.sol";
import {IJBController} from "@nana-core-v5/interfaces/IJBController.sol";
import {IJBTokens} from "@nana-core-v5/interfaces/IJBTokens.sol";
import {JBConstants} from "@nana-core-v5/libraries/JBConstants.sol";

import {IDePrizeRegistry} from "./deprize/IDePrizeRegistry.sol";

// ReopenPayHook
//
//   Successor to LaunchPadPayHook for RE-OPENED missions, where token holders who
//   minted at different issuance rates coexist (e.g. the original 1,000/ETH backers
//   and 500/ETH re-open backers of the same project).
//
//   Why a new hook: LaunchPadPayHook reconstructs the cash-out denominator as
//   `currentFunding * activeWeight / 2e18`, which is only correct when every
//   outstanding token was minted at the CURRENT ruleset weight. Once a second rate
//   exists that reconstruction understates the real supply, over-committing the pot:
//   early redeemers reclaim more than their share and late redeemers get nothing.
//
//   Fix: derive the denominator from real on-chain supply instead of funding*weight.
//
//     claimEligibleSupply = totalTokenSupplyWithReservedTokensOf(projectId)
//                         - pendingReservedTokenBalanceOf(projectId)
//                         - Σ balances of `reservedHolders` (vesting contracts, pool
//                           deployer — the reserved-token allocations, which are not
//                           eligible for refunds)
//
//   Every claim-eligible token then reclaims the same amount, claims sum to exactly
//   the pot (no overdraw, no stranded funds), and the result is independent of
//   redemption order and of how many issuance rates ever existed. Reserved-side
//   holders are blocked from cashing out; if a vesting contract releases tokens to a
//   beneficiary, the denominator grows by exactly those tokens, preserving the
//   invariant.
//
//   Everything else (funding kill-switch, goal/deadline gating, refund window,
//   stage(), optional DePrize registry latch) matches LaunchPadPayHook.
contract ReopenPayHook is IJBRulesetDataHook, Ownable {

    uint256 public immutable fundingGoal;
    uint256 public immutable deadline;
    uint256 public immutable refundPeriod;

    bool public fundingTurnedOff;
    bool public refundsEnabled;

    IJBTerminalStore public jbTerminalStore;
    IJBRulesets public jbRulesets;
    IJBController public jbController;
    IJBTokens public jbTokens;

    /// @notice Holders of reserved-token allocations (vesting contracts, pool
    ///         deployer). Their balances are excluded from the cash-out denominator
    ///         and they cannot cash out themselves.
    address[] public reservedHolders;

    /// @notice Optional DePrize source of truth. When unset, the hook behaves
    ///         exactly as the original (non-DePrize) hook.
    IDePrizeRegistry public deprizeRegistry;

    event DePrizeRegistrySet(address indexed registry);

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
            reservedHolders.push(_reservedHolders[i]);
        }
    }

    function setFundingTurnedOff(bool _fundingTurnedOff) external onlyOwner {
        fundingTurnedOff = _fundingTurnedOff;
    }

    function enableRefunds(bool _refundsEnabled) external onlyOwner {
        refundsEnabled = _refundsEnabled;
    }

    /// @notice Attach the DePrize registry. Owner-gated and write-once, same
    ///         rationale as LaunchPadPayHook.setDePrizeRegistry.
    function setDePrizeRegistry(address _registry) external onlyOwner {
        if (address(deprizeRegistry) != address(0)) revert DePrizeRegistryAlreadySet();
        require(_registry != address(0), "registry is zero");
        deprizeRegistry = IDePrizeRegistry(_registry);
        emit DePrizeRegistrySet(_registry);
    }

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

    /// @notice The number of tokens eligible to claim refunds: total supply
    ///         (including pending reserved) minus pending reserved minus balances
    ///         held by reserved-token allocation holders.
    /// @param projectId The project to compute the supply for.
    /// @param totalSupplyWithReserved `totalTokenSupplyWithReservedTokensOf`, as
    ///        passed by the terminal store in the cash-out context.
    function claimEligibleSupply(uint256 projectId, uint256 totalSupplyWithReserved) public view returns (uint256) {
        uint256 supply = totalSupplyWithReserved - jbController.pendingReservedTokenBalanceOf(projectId);
        for (uint256 i = 0; i < reservedHolders.length; i++) {
            supply -= jbTokens.totalBalanceOf(reservedHolders[i], projectId);
        }
        return supply;
    }

    function beforePayRecordedWith(JBBeforePayRecordedContext calldata context) external view override returns (uint256 weight, JBPayHookSpecification[] memory hookSpecifications) {
        if (fundingTurnedOff) {
            revert("Funding has been turned off.");
        }
        require(context.amount.token == JBConstants.NATIVE_TOKEN);

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

    function beforeCashOutRecordedWith(JBBeforeCashOutRecordedContext calldata context) external view override
        returns (
        uint256 cashOutTaxRate,
        uint256 cashOutCount,
        uint256 totalSupply,
        JBCashOutHookSpecification[] memory hookSpecifications
    ){
        // Reserved-token allocations are not part of the denominator, so letting
        // them redeem would overdraw the pot.
        if (isReservedHolder(context.holder)) {
            revert("Reserved token allocations cannot cash out.");
        }

        uint256 deprizeId = _deprizeIdFor(context.projectId);
        if (deprizeId != 0) {
            if (!deprizeRegistry.isRefundable(deprizeId)) {
                revert("DePrize is active. Refunds are disabled.");
            }
            cashOutCount = context.cashOutCount;
            totalSupply = claimEligibleSupply(context.projectId, context.totalSupply);
            return (cashOutTaxRate, cashOutCount, totalSupply, hookSpecifications);
        }

        uint256 currentFunding = _totalFunding(context.terminal, context.projectId);
        if (!refundsEnabled && currentFunding >= fundingGoal){
            revert("Project has passed funding goal requirement. Refunds are disabled.");
        }
        if (block.timestamp < deadline) {
            revert("Project funding deadline has not passed. Refunds are disabled.");
        }
        if (block.timestamp >= deadline + refundPeriod) {
            revert("Refund period has passed. Refunds are disabled.");
        }

        // Refund amount = surplus * (cashOutCount / claimEligibleSupply). Unlike the
        // original funding*weight reconstruction, this is exact for any mix of
        // issuance rates: claims sum to the pot and are independent of redemption
        // order. Holders who minted at a higher rate hold proportionally more claim.
        cashOutCount = context.cashOutCount;
        totalSupply = claimEligibleSupply(context.projectId, context.totalSupply);
    }

    function hasMintPermissionFor(uint256 projectId, JBRuleset memory ruleset, address addr) external view override returns (bool flag){
        return false;
    }

    /// @notice ERC165 support.
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IJBRulesetDataHook).interfaceId;
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
