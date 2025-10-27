// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/interfaces/IERC165.sol";
import "@nana-core-v5/interfaces/IJBRulesetApprovalHook.sol";
import "@nana-core-v5/interfaces/IJBTerminalStore.sol";
import "@nana-core-v5/libraries/JBConstants.sol";
import {JBRuleset} from "@nana-core-v5/structs/JBRuleset.sol";

// Hook to enable payouts after a funding goal is reached and a deadline is passed.
contract LaunchPadApprovalHook is IJBRulesetApprovalHook, Ownable {
    uint256 public immutable fundingGoal;
    uint256 public immutable deadline;
    uint256 public immutable refundPeriod;
    IJBTerminalStore public immutable jbTerminalStore;
    address public immutable terminal;
    bool public refundsEnabled;

    constructor(
        uint256 _fundingGoal,
        uint256 _deadline,
        uint256 _refundPeriod,
        address _jbTerminalStoreAddress,
        address _terminal,
        address owner
    ) Ownable(owner) {
        fundingGoal = _fundingGoal;
        deadline = _deadline;
        refundPeriod = _refundPeriod;
        jbTerminalStore = IJBTerminalStore(_jbTerminalStoreAddress);
        terminal = _terminal;
    }

    function DURATION() external view override returns (uint256) {
        return 0;
    }

    function enableRefunds(bool _refundsEnabled) external onlyOwner {
        refundsEnabled = _refundsEnabled;
    }

    function approvalStatusOf(
        uint256 projectId,
        JBRuleset memory ruleset
    ) external view override returns (JBApprovalStatus) {
        uint256 currentFunding = _totalFunding(terminal, projectId);
        if (refundsEnabled) {
            return JBApprovalStatus.Approved;
        } else if (currentFunding >= fundingGoal && block.timestamp >= deadline) {
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

    function _totalFunding(address _terminal, uint256 projectId)
        internal
        view
        returns (uint256)
    {
        uint256 balance = jbTerminalStore.balanceOf(
            _terminal,
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
}
