// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { console2 } from "forge-std/Test.sol"; // remove before deploy
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {JBPayHookSpecification} from "@nana-core/structs/JBPayHookSpecification.sol";
import {IJBRulesets} from "@nana-core/interfaces/IJBRulesets.sol";
import {JBBeforePayRecordedContext} from "@nana-core/structs/JBBeforePayRecordedContext.sol";
import {JBBeforeCashOutRecordedContext} from "@nana-core/structs/JBBeforeCashOutRecordedContext.sol";
import {JBCashOutHookSpecification} from "@nana-core/structs/JBCashOutHookSpecification.sol";
import {IJBTerminalStore} from "@nana-core/interfaces/IJBTerminalStore.sol";
import {IJBRulesetDataHook} from "@nana-core/interfaces/IJBRulesetDataHook.sol";
import { JBConstants } from "@nana-core/libraries/JBConstants.sol";


// LaunchPadPayHook implements the common logic:
//   • Storing minFundingRequired, fundingGoal and deadline.
//   • Holding references to the IJBTerminalStore contract.
//   • A helper function (_totalFunding) to read total funding.
//   • An Ownable toggle (setFundingTurnedOff) for the fundingTurnedOff flag.
//   • The beforePayRecordedWith function manipulates the weight to change number
//     of tokens received per ETH based on the funding status.
contract LaunchPadPayHook is IJBRulesetDataHook, Ownable {

    uint256 public immutable fundingGoal;
    uint256 public immutable deadline;
    uint256 cashedOutCount;

    // fundingTurnedOff can be toggled by the owner.
    bool public fundingTurnedOff;

    IJBTerminalStore public jbTerminalStore;
    IJBRulesets jbRulesets;

    constructor(
        uint256 _fundingGoal,
        uint256 _deadline,
        address _jbTerminalStoreAddress,
        address _jbRulesetAddress,
        address owner
    ) Ownable(owner) {
        fundingGoal = _fundingGoal;
        deadline = _deadline;
        jbTerminalStore = IJBTerminalStore(_jbTerminalStoreAddress);
        jbRulesets = IJBRulesets(_jbRulesetAddress);
    }

    function setFundingTurnedOff(bool _fundingTurnedOff) external onlyOwner {
        fundingTurnedOff = _fundingTurnedOff;
    }

    function _totalFunding(address terminal, uint256 projectId) internal view returns (uint256) {
        return jbTerminalStore.balanceOf(terminal, projectId, JBConstants.NATIVE_TOKEN);
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
        if (currentFunding >= fundingGoal){
            revert("Project has passed funding goal requirement. Refunds are disabled.");
        }
        if (block.timestamp < deadline) {
            revert("Project funding deadline has not passed. Refunds are disabled.");
        }
        // Refund amount = currentFunds * (userTokenCount / currentTokenSupply)
        // Since reserved tokens are not eligible for refunds, and the reserve rate
        // is 50%, we need to divide the currentTokenSupply by 2.
        // context.totalSupply includes reserved tokens, so instead calculate the
        // totalSupply as currentFunding * rateTier1.
        uint256 weight = jbRulesets.getRulesetOf(context.projectId, context.rulesetId).weight;
        cashOutCount = context.cashOutCount;
        totalSupply = (currentFunding * weight) / (2 * 1e18);
    }

    function hasMintPermissionFor(uint256 projectId, address addr) external view override returns (bool flag){
        return false;
    }

    /// @notice ERC165 support.
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IJBRulesetDataHook).interfaceId;
    }

    // return a stage number based on what tier the project is in.
    function stage(address terminal, uint256 projectId) public view returns (uint256) {
        uint256 currentFunding = _totalFunding(terminal, projectId);
        if (currentFunding < fundingGoal) {
            if (block.timestamp >= deadline) {
                return 3; // Refund stage
            } else {
                return 1; // Stage 1
            }
        } else {
            return 2; // Stage 3
        }
    }
}
