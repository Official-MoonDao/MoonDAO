// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/interfaces/IERC165.sol";
import "@nana-core-v5/interfaces/IJBRulesetApprovalHook.sol";
import "@nana-core-v5/interfaces/IJBTerminalStore.sol";
import "@nana-core-v5/libraries/JBConstants.sol";
import {JBRuleset} from "@nana-core-v5/structs/JBRuleset.sol";
import {IDePrizeRegistry} from "./deprize/IDePrizeRegistry.sol";

interface ILaunchPadPayHook {
    function refundsEnabled() external view returns (bool);
    /// @dev Returns the optional DePrize registry the pay hook defers to (or
    ///      address(0) for a classic time-based launchpad). Single source of
    ///      truth: the approval hook reads it here rather than holding its own.
    function deprizeRegistry() external view returns (address);
}

// Hook to enable payouts after a funding goal is reached and a deadline is passed.
contract LaunchPadApprovalHook is IJBRulesetApprovalHook, Ownable {
    uint256 public immutable fundingGoal;
    uint256 public immutable deadline;
    uint256 public immutable refundPeriod;
    IJBTerminalStore public immutable jbTerminalStore;
    address public immutable terminal;
    ILaunchPadPayHook public immutable payHook;

    constructor(
        uint256 _fundingGoal,
        uint256 _deadline,
        uint256 _refundPeriod,
        address _jbTerminalStoreAddress,
        address _terminal,
        address _payHook,
        address owner
    ) Ownable(owner) {
        fundingGoal = _fundingGoal;
        deadline = _deadline;
        refundPeriod = _refundPeriod;
        jbTerminalStore = IJBTerminalStore(_jbTerminalStoreAddress);
        terminal = _terminal;
        require(_payHook != address(0), "LaunchPadApprovalHook: invalid pay hook");
        payHook = ILaunchPadPayHook(_payHook);
    }

    function DURATION() external view override returns (uint256) {
        return 0;
    }

    // Single source of truth lives on the pay hook.
    function refundsEnabled() public view returns (bool) {
        return payHook.refundsEnabled();
    }

    /// @notice The DePrize id bound to `projectId`, or 0 when this is a classic
    ///         time-based launchpad (no registry) or the project has no DePrize
    ///         attached. Mirrors the pay hook so both gates agree.
    function _deprizeIdFor(uint256 projectId) internal view returns (uint256) {
        address registry = payHook.deprizeRegistry();
        if (registry == address(0)) return 0;
        return IDePrizeRegistry(registry).deprizeIdByJBProject(projectId);
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
    //
    // DePrize-governed missions ignore the immutable deadline/goal entirely:
    // payouts (ruleset 2) unlock only when the prize wraps up successfully — a
    // non-refundable terminal state (M2_COMPLETE, "requirements met by a team").
    // While the campaign is active, or on a refundable terminal, the ruleset
    // stays in funding/refund so the pot stays locked and contributor refunds
    // (gated by the pay hook) remain available with no deadline expiry. Finer
    // milestone-gated releases (30% at M1, 70% at M2) are the MilestoneEscrow's
    // job in a later milestone; until then funds stay fully locked until M2.
    function approvalStatusOf(
        uint256 projectId,
        JBRuleset memory ruleset
    ) external view override returns (JBApprovalStatus) {
        uint256 deprizeId = _deprizeIdFor(projectId);
        if (deprizeId != 0) {
            IDePrizeRegistry registry = IDePrizeRegistry(payHook.deprizeRegistry());
            if (registry.isTerminal(deprizeId) && !registry.isRefundable(deprizeId)) {
                return JBApprovalStatus.Approved; // prize completed → unlock payouts
            }
            return JBApprovalStatus.Failed; // active or refundable → stay locked
        }

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
