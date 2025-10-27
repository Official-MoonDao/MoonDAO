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
import { JBConstants } from "@nana-core-v5/libraries/JBConstants.sol";
import {FundingOracle} from "./FundingOracle.sol";


// LaunchPadPayHook
//   • Stores minFundingRequired, fundingGoal and deadline.
//   • Holdes references to the IJBTerminalStore contract.
//   • A helper function (_totalLocalFunding) to read total funding.
//   • An Ownable toggle (setFundingTurnedOff) for the fundingTurnedOff flag.
//   • The beforePayRecordedWith function manipulates the weight to change number
//     of tokens received per ETH based on the funding status.
contract LaunchPadPayHook is IJBRulesetDataHook, Ownable {

    uint256 public immutable fundingGoal;
    uint256 public immutable deadline;
    uint256 public immutable refundPeriod;
    uint256 cashedOutCount;
    address public fundingOracleAddress;
    uint256 missionId;

    // fundingTurnedOff can be toggled by the owner.
    bool public fundingTurnedOff;

    IJBTerminalStore public jbTerminalStore;
    IJBRulesets jbRulesets;

    constructor(
        uint256 _fundingGoal,
        uint256 _deadline,
        uint256 _refundPeriod,
        address _jbTerminalStoreAddress,
        address _jbRulesetAddress,
        address _fundingOracleAddress,
        address owner
    ) Ownable(owner) {
        fundingGoal = _fundingGoal;
        deadline = _deadline;
        refundPeriod = _refundPeriod;
        jbTerminalStore = IJBTerminalStore(_jbTerminalStoreAddress);
        jbRulesets = IJBRulesets(_jbRulesetAddress);
        fundingOracleAddress = _fundingOracleAddress;
    }

    function setMissionId(uint256 _missionId) external {
        require(missionId != 0, "Mission ID already set!");
        missionId = _missionId;
    }

    function setFundingTurnedOff(bool _fundingTurnedOff) external onlyOwner {
        fundingTurnedOff = _fundingTurnedOff;
    }

    function _totalLocalFunding(address terminal, uint256 projectId) internal view returns (uint256) {
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
        require(missionId != 0, "Mission ID not set!");
        uint256 totalFunding = FundingOracle(fundingOracleAddress).missionIdToFunding(missionId);
        require(context.amount.token == JBConstants.NATIVE_TOKEN);
        if (totalFunding < fundingGoal && block.timestamp >= deadline) {
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
        require(missionId != 0, "Mission ID not set!");
        uint256 totalFunding = FundingOracle(fundingOracleAddress).missionIdToFunding(missionId);
        if (totalFunding >= fundingGoal){
            revert("Project has passed funding goal requirement. Refunds are disabled.");
        }
        if (block.timestamp < deadline) {
            revert("Project funding deadline has not passed. Refunds are disabled.");
        }
        if (block.timestamp >= deadline + refundPeriod) {
            revert("Refund period has passed. Refunds are disabled.");
        }
        uint256 localFunding = _totalLocalFunding(context.terminal, context.projectId);
        // Refund amount = currentFunds * (userTokenCount / currentTokenSupply)
        // Since reserved tokens are not eligible for refunds, and the reserve rate
        // is 50%, we need to divide the currentTokenSupply by 2.
        // context.totalSupply includes reserved tokens, so instead calculate the
        // totalSupply as currentFunding * rateTier1.
        uint256 weight = jbRulesets.getRulesetOf(context.projectId, context.rulesetId).weight;
        cashOutCount = context.cashOutCount;
        totalSupply = (localFunding * weight) / (2 * 1e18);
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
        require(missionId != 0, "Mission ID not set!");
        uint256 totalFunding = FundingOracle(fundingOracleAddress).missionIdToFunding(missionId);
        if (totalFunding < fundingGoal) {
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
