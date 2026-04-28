// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/interfaces/IERC165.sol";
import "@nana-core-v5/interfaces/IJBRulesetApprovalHook.sol";
import "@nana-core-v5/interfaces/IJBTerminalStore.sol";
import "@nana-core-v5/libraries/JBConstants.sol";
import {JBRuleset} from "@nana-core-v5/structs/JBRuleset.sol";

interface ILaunchPadPayHookRefunds {
    function refundsEnabled() external view returns (bool);
}

// Hook to enable payouts after a funding goal is reached and a deadline is passed.
contract LaunchPadApprovalHook is IJBRulesetApprovalHook, Ownable {
    uint256 public immutable fundingGoal;
    uint256 public immutable deadline;
    uint256 public immutable refundPeriod;
    IJBTerminalStore public immutable jbTerminalStore;
    address public immutable terminal;
    /// @notice The pay hook is the single source of truth for the refunds flag.
    /// The approval hook reads `refundsEnabled` from it on demand so the two
    /// hooks can never be in an inconsistent state.
    ILaunchPadPayHookRefunds public payHook;

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

    /// @notice Wire up the pay hook that owns the canonical `refundsEnabled`
    /// flag. Settable exactly once. Intentionally permissionless because the
    /// MissionCreator (which deploys both hooks) calls this immediately after
    /// construction, while the contract owner has already been set to the
    /// team multisig. The one-shot guard prevents anyone from front-running or
    /// later changing the wiring.
    function setPayHook(address _payHook) external {
        require(address(payHook) == address(0), "Pay hook already set");
        require(_payHook != address(0), "Zero address");
        payHook = ILaunchPadPayHookRefunds(_payHook);
    }

    function refundsEnabled() public view returns (bool) {
        if (address(payHook) == address(0)) return false;
        return payHook.refundsEnabled();
    }

    // Missions have 2 rulesets.
    // Ruleset 1 is for active funding/refunds
    // Ruleset 2 is for payouts
    // Returning Approved will advance the ruleset from 1->2, whereas
    // returning Failed will keep the mission in ruleset 1.
    // If refunds are manually enabled, we'll stay in ruleset
    // 1 even if the funding goal is achieved.
    // If not, we will advance to payouts if when the funding goal is achieved.
    // In either case, after the refund period has passed, the rulset will advance
    // to payouts.
    function approvalStatusOf(
        uint256 projectId,
        JBRuleset memory ruleset
    ) external view override returns (JBApprovalStatus) {
        uint256 currentFunding = _totalFunding(terminal, projectId);
        bool _refundsEnabled = refundsEnabled();
        if (_refundsEnabled && block.timestamp < deadline + refundPeriod) {
            return JBApprovalStatus.Failed;
        } else if (_refundsEnabled && block.timestamp >= deadline + refundPeriod) {
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
