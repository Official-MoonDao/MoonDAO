// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/interfaces/IERC165.sol";
import "@nana-core-v5/interfaces/IJBRulesetApprovalHook.sol";
import "@nana-core-v5/interfaces/IJBTerminalStore.sol";
import "@nana-core-v5/libraries/JBConstants.sol";
import {JBRuleset} from "@nana-core-v5/structs/JBRuleset.sol";
import {FundingOracle} from "./FundingOracle.sol";

// Hook to enable payouts after a funding goal is reached and a deadline is passed.
contract LaunchPadApprovalHook is IJBRulesetApprovalHook {
    uint256 public immutable fundingGoal;
    uint256 public immutable deadline;
    uint256 public immutable refundPeriod;
    IJBTerminalStore public immutable jbTerminalStore;
    address public immutable terminal;
    address public fundingOracleAddress;
    uint256 missionId;

    constructor(
        uint256 _fundingGoal,
        uint256 _deadline,
        uint256 _refundPeriod,
        address _jbTerminalStoreAddress,
        address _terminal,
        address _fundingOracleAddress
    ) {
        fundingGoal = _fundingGoal;
        deadline = _deadline;
        refundPeriod = _refundPeriod;
        jbTerminalStore = IJBTerminalStore(_jbTerminalStoreAddress);
        terminal = _terminal;
        fundingOracleAddress = _fundingOracleAddress;
    }

    function DURATION() external view override returns (uint256) {
        return 0;
    }

    function setMissionId(uint256 _missionId) external {
        require(missionId != 0, "Mission ID already set!");
        missionId = _missionId;
    }

    function approvalStatusOf(
        uint256 projectId,
        JBRuleset memory ruleset
    ) external view override returns (JBApprovalStatus) {
        require(missionId != 0, "Mission ID not set!");
        uint256 currentFunding = FundingOracle(fundingOracleAddress).missionIdToFunding(missionId);
        if (currentFunding >= fundingGoal && block.timestamp >= deadline) {
            return JBApprovalStatus.Approved;
        } else if (currentFunding < fundingGoal && block.timestamp >= deadline + refundPeriod) {
            return JBApprovalStatus.Approved;
        } else {
            return JBApprovalStatus.Failed;
        }
    }

    function supportsInterface(bytes4 interfaceId)
        external
        pure
        override
        returns (bool)
    {
        return
            interfaceId == type(IJBRulesetApprovalHook).interfaceId ||
            interfaceId == type(IERC165).interfaceId;
    }
}
