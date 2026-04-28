// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {JBPayHookSpecification} from "@nana-core-v5/structs/JBPayHookSpecification.sol";
import {IJBRulesets} from "@nana-core-v5/interfaces/IJBRulesets.sol";
import {JBRuleset} from "@nana-core-v5/structs/JBRuleset.sol";
import {JBRulesetMetadataResolver} from "@nana-core-v5/libraries/JBRulesetMetadataResolver.sol";

import {JBBeforePayRecordedContext} from "@nana-core-v5/structs/JBBeforePayRecordedContext.sol";
import {JBBeforeCashOutRecordedContext} from "@nana-core-v5/structs/JBBeforeCashOutRecordedContext.sol";
import {JBCashOutHookSpecification} from "@nana-core-v5/structs/JBCashOutHookSpecification.sol";
import {IJBTerminalStore} from "@nana-core-v5/interfaces/IJBTerminalStore.sol";
import {IJBRulesetDataHook} from "@nana-core-v5/interfaces/IJBRulesetDataHook.sol";
import { JBConstants } from "@nana-core-v5/libraries/JBConstants.sol";


// LaunchPadPayHook
//   • Stores minFundingRequired, fundingGoal and deadline.
//   • Holdes references to the IJBTerminalStore contract.
//   • A helper function (_totalFunding) to read total funding.
//   • An Ownable toggle (setFundingTurnedOff) for the fundingTurnedOff flag.
//   • The beforePayRecordedWith function manipulates the weight to change number
//     of tokens received per ETH based on the funding status.
contract LaunchPadPayHook is IJBRulesetDataHook, Ownable {
    using JBRulesetMetadataResolver for JBRuleset;

    uint256 public immutable fundingGoal;
    uint256 public immutable deadline;
    uint256 public immutable refundPeriod;
    uint256 cashedOutCount;

    // fundingTurnedOff can be toggled by the owner.
    bool public fundingTurnedOff;
    bool public refundsEnabled;

    IJBTerminalStore public jbTerminalStore;
    IJBRulesets jbRulesets;

    constructor(
        uint256 _fundingGoal,
        uint256 _deadline,
        uint256 _refundPeriod,
        address _jbTerminalStoreAddress,
        address _jbRulesetAddress,
        address owner
    ) Ownable(owner) {
        fundingGoal = _fundingGoal;
        deadline = _deadline;
        refundPeriod = _refundPeriod;
        jbTerminalStore = IJBTerminalStore(_jbTerminalStoreAddress);
        jbRulesets = IJBRulesets(_jbRulesetAddress);
    }

    function setFundingTurnedOff(bool _fundingTurnedOff) external onlyOwner {
        fundingTurnedOff = _fundingTurnedOff;
    }

    function enableRefunds(bool _refundsEnabled) external onlyOwner {
        refundsEnabled = _refundsEnabled;
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

    function beforePayRecordedWith(JBBeforePayRecordedContext calldata context) external view override returns (uint256 weight, JBPayHookSpecification[] memory hookSpecifications) {
        if (fundingTurnedOff) {
            revert("Funding has been turned off.");
        }
        uint256 currentFunding = _totalFunding(context.terminal, context.projectId);
        require(context.amount.token == JBConstants.NATIVE_TOKEN);
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
        // Refund amount = currentFunds * (userTokenCount / nonReservedSupply)
        // Reserved tokens are not eligible for refunds. Rather than trusting
        // the on-chain `totalSupply` (which would include any tokens minted via
        // routes other than payments), we reconstruct the non-reserved supply
        // from the funded ETH amount, the ruleset's issuance weight, and the
        // ruleset's actual `reservedPercent` (read live, not hard-coded). This
        // keeps the refund math correct even if the reserve rate is changed by
        // a governance action between launch and refund.
        JBRuleset memory ruleset = jbRulesets.getRulesetOf(context.projectId, context.rulesetId);
        uint256 weight = ruleset.weight;
        uint256 reservedPercent = ruleset.reservedPercent();
        uint256 maxReserved = JBConstants.MAX_RESERVED_PERCENT;
        // Tokens issued to payers per 1e18 of ETH = weight * (MAX - reservedPercent) / MAX.
        // Total non-reserved supply = currentFunding * weight * (MAX - reservedPercent) / (MAX * 1e18).
        cashOutCount = context.cashOutCount;
        totalSupply = (currentFunding * weight * (maxReserved - reservedPercent)) / (maxReserved * 1e18);
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
