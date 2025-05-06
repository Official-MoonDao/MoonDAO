// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/interfaces/IERC165.sol";
import "@nana-core/interfaces/IJBRulesetApprovalHook.sol";
import "@nana-core/interfaces/IJBTerminalStore.sol";
import "@nana-core/libraries/JBConstants.sol";

// Hook to enable payouts after a funding goal is reached and a deadline is passed.
contract LaunchPadApprovalHook is IJBRulesetApprovalHook {
    uint256 public immutable fundingGoal;
    uint256 public immutable deadline; // how long after start we wait
    IJBTerminalStore public immutable jbTerminalStore;
    address public immutable terminal;

    constructor(
        uint256 _fundingGoal,
        uint256 _deadline,
        address _jbTerminalStoreAddress,
        address _terminal
    ) {
        fundingGoal = _fundingGoal;
        deadline = _deadline;
        jbTerminalStore = IJBTerminalStore(_jbTerminalStoreAddress);
        terminal = _terminal;
    }

    function DURATION() external view override returns (uint256) {
        return 0;
    }

    function approvalStatusOf(
        uint256 projectId,
        uint256,
        uint256 start
    ) external view override returns (JBApprovalStatus) {
        uint256 currentFunding = _totalFunding(terminal, projectId);
        if (currentFunding >= fundingGoal && block.timestamp >= deadline) {
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
        return jbTerminalStore.balanceOf(
            _terminal,
            projectId,
            JBConstants.NATIVE_TOKEN
        );
    }
}
