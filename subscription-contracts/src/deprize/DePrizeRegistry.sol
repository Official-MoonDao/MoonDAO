// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IDePrizeRegistry} from "./IDePrizeRegistry.sol";

/// @title DePrizeRegistry
/// @notice On-chain state machine and source of truth for the DePrize lifecycle.
///
/// @dev Lifecycle:
///
///   register() ──► DRAFT ──open──► OPEN ──lock──► LOCKED ──settleWinner──► SETTLED
///                                                    │
///                                                    └──settleNoWinner──► NO_WINNER
///
///   supersede:  OPEN|LOCKED ──► SUPERSEDED (new generation registered in DRAFT)
///   cancel:     any non-terminal ──► CANCELLED (after CANCELLATION_NOTICE)
///
///   Refund terminals: CANCELLED, NO_WINNER.  Success terminal: SETTLED.
///
///      Immutable and non-upgradeable. Owner is the admin Safe (Ownable2Step so a
///      mistyped transfer cannot orphan the registry).
contract DePrizeRegistry is Ownable2Step, IDePrizeRegistry {
    /// @inheritdoc IDePrizeRegistry
    uint256 public constant override CANCELLATION_NOTICE = 7 days;

    uint256 private _nextId = 1;
    mapping(uint256 => DePrize) private _deprizes;
    mapping(uint256 => uint256) private _deprizeIdByJBProject;
    mapping(uint256 => mapping(uint256 => bool)) private _isTeam;

    /// @dev Generation lineage. `_supersededBy[old] = new`, `_supersedes[new] = old`.
    mapping(uint256 => uint256) private _supersededBy;
    mapping(uint256 => uint256) private _supersedes;

    error RenounceDisabled();

    constructor(address owner_) Ownable(owner_) {}

    /// @dev An ownerless immutable registry could never open, settle or cancel
    ///      a DePrize. Ownership moves only through the two-step transfer.
    function renounceOwnership() public view override onlyOwner {
        revert RenounceDisabled();
    }

    // ---------------------------------------------------------------------
    // Registration & configuration
    // ---------------------------------------------------------------------

    /// @inheritdoc IDePrizeRegistry
    function register(uint256 jbProjectId, uint256[] calldata teamIds_, uint256 sunset)
        external
        override
        onlyOwner
        returns (uint256 deprizeId)
    {
        if (jbProjectId == 0) revert InvalidJBProject();
        if (_deprizeIdByJBProject[jbProjectId] != 0) revert JBProjectAlreadyBound(jbProjectId);
        if (sunset <= block.timestamp) revert InvalidSunset();

        deprizeId = _create(jbProjectId, teamIds_, sunset);
        _deprizeIdByJBProject[jbProjectId] = deprizeId;

        emit DePrizeRegistered(deprizeId, jbProjectId, teamIds_, sunset);
        emit StateChanged(deprizeId, DePrizeState.NONE, DePrizeState.DRAFT);
    }

    /// @inheritdoc IDePrizeRegistry
    function setCondition(uint256 deprizeId, bytes32 ctfConditionId) external override onlyOwner {
        DePrize storage d = _requireState(deprizeId, DePrizeState.DRAFT);
        d.ctfConditionId = ctfConditionId;
        emit ConditionSet(deprizeId, ctfConditionId);
    }

    /// @inheritdoc IDePrizeRegistry
    function setSunset(uint256 deprizeId, uint256 sunset) external override onlyOwner {
        DePrize storage d = _get(deprizeId);
        if (sunset <= block.timestamp) revert InvalidSunset();
        if (d.state == DePrizeState.OPEN) {
            if (sunset <= d.sunset) revert SunsetNotExtended(d.sunset, sunset);
        } else if (d.state != DePrizeState.DRAFT) {
            revert InvalidState(deprizeId, d.state);
        }
        d.sunset = sunset;
        emit SunsetUpdated(deprizeId, sunset);
    }

    /// @inheritdoc IDePrizeRegistry
    function setTeams(uint256 deprizeId, uint256[] calldata teamIds_) external override onlyOwner {
        DePrize storage d = _requireState(deprizeId, DePrizeState.DRAFT);

        // Clear-then-write so stale `_isTeam` entries cannot let settleWinner
        // accept a team that is no longer on the roster.
        uint256 oldLen = d.teamIds.length;
        for (uint256 i = 0; i < oldLen; i++) {
            _isTeam[deprizeId][d.teamIds[i]] = false;
        }
        delete d.teamIds;
        _writeRoster(deprizeId, d, teamIds_);

        emit TeamsUpdated(deprizeId, teamIds_);
    }

    /// @inheritdoc IDePrizeRegistry
    function supersede(uint256 oldDeprizeId, uint256[] calldata newTeamIds, uint256 sunset)
        external
        override
        onlyOwner
        returns (uint256 newDeprizeId)
    {
        DePrize storage old = _get(oldDeprizeId);
        if (old.state != DePrizeState.OPEN && old.state != DePrizeState.LOCKED) {
            revert InvalidState(oldDeprizeId, old.state);
        }
        if (sunset <= block.timestamp) revert InvalidSunset();

        if (old.cancellationNoticeAt != 0) {
            old.cancellationNoticeAt = 0;
            emit CancellationAborted(oldDeprizeId);
        }

        uint256 jbProjectId = old.jbProjectId;
        newDeprizeId = _create(jbProjectId, newTeamIds, sunset);

        // The old entry must be SUPERSEDED (terminal, not refundable) BEFORE the
        // JB mapping points at the new DRAFT, so the pay hook never observes a
        // refundable DePrize on a funded project.
        _supersededBy[oldDeprizeId] = newDeprizeId;
        _supersedes[newDeprizeId] = oldDeprizeId;
        _setState(oldDeprizeId, old, DePrizeState.SUPERSEDED);
        _deprizeIdByJBProject[jbProjectId] = newDeprizeId;

        emit DePrizeRegistered(newDeprizeId, jbProjectId, newTeamIds, sunset);
        emit StateChanged(newDeprizeId, DePrizeState.NONE, DePrizeState.DRAFT);
        emit DePrizeSuperseded(oldDeprizeId, newDeprizeId, newTeamIds);
    }

    // ---------------------------------------------------------------------
    // Lifecycle transitions
    // ---------------------------------------------------------------------

    /// @inheritdoc IDePrizeRegistry
    function open(uint256 deprizeId) external override onlyOwner {
        DePrize storage d = _requireState(deprizeId, DePrizeState.DRAFT);
        if (d.ctfConditionId == bytes32(0)) revert ConditionNotSet(deprizeId);
        if (d.sunset <= block.timestamp) revert InvalidSunset();
        _setState(deprizeId, d, DePrizeState.OPEN);
    }

    /// @inheritdoc IDePrizeRegistry
    function lock(uint256 deprizeId) external override onlyOwner {
        DePrize storage d = _requireState(deprizeId, DePrizeState.OPEN);
        _setState(deprizeId, d, DePrizeState.LOCKED);
    }

    /// @inheritdoc IDePrizeRegistry
    function settleWinner(uint256 deprizeId, uint256 winningTeamId_) external override onlyOwner {
        DePrize storage d = _requireState(deprizeId, DePrizeState.LOCKED);
        if (!_isTeam[deprizeId][winningTeamId_]) revert UnknownTeam(deprizeId, winningTeamId_);
        d.winningTeamId = winningTeamId_;
        _clearNotice(deprizeId, d);
        _setState(deprizeId, d, DePrizeState.SETTLED);
        emit WinnerDeclared(deprizeId, winningTeamId_);
    }

    /// @inheritdoc IDePrizeRegistry
    function settleNoWinner(uint256 deprizeId) external override onlyOwner {
        DePrize storage d = _requireState(deprizeId, DePrizeState.LOCKED);
        _clearNotice(deprizeId, d);
        _setState(deprizeId, d, DePrizeState.NO_WINNER);
    }

    // ---------------------------------------------------------------------
    // Cancellation (7-day notice)
    // ---------------------------------------------------------------------

    /// @inheritdoc IDePrizeRegistry
    function announceCancellation(uint256 deprizeId) external override onlyOwner {
        DePrize storage d = _get(deprizeId);
        if (_isTerminalState(d.state)) revert InvalidState(deprizeId, d.state);
        // Explicit abort required before re-announcing so the window cannot be
        // silently reset (bettors and monitors track a single executableAt).
        if (d.cancellationNoticeAt != 0) revert CancellationAlreadyPending(deprizeId);
        d.cancellationNoticeAt = block.timestamp;
        emit CancellationAnnounced(deprizeId, block.timestamp, block.timestamp + CANCELLATION_NOTICE);
    }

    /// @inheritdoc IDePrizeRegistry
    function abortCancellation(uint256 deprizeId) external override onlyOwner {
        DePrize storage d = _get(deprizeId);
        if (d.cancellationNoticeAt == 0) revert NoCancellationPending(deprizeId);
        d.cancellationNoticeAt = 0;
        emit CancellationAborted(deprizeId);
    }

    /// @inheritdoc IDePrizeRegistry
    function cancel(uint256 deprizeId) external override onlyOwner {
        DePrize storage d = _get(deprizeId);
        if (d.cancellationNoticeAt == 0) revert NoCancellationPending(deprizeId);
        uint256 executableAt = d.cancellationNoticeAt + CANCELLATION_NOTICE;
        if (block.timestamp < executableAt) revert CancellationNoticeNotElapsed(deprizeId, executableAt);
        if (_isTerminalState(d.state)) revert InvalidState(deprizeId, d.state);
        d.cancellationNoticeAt = 0;
        _setState(deprizeId, d, DePrizeState.CANCELLED);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    /// @inheritdoc IDePrizeRegistry
    function state(uint256 deprizeId) external view override returns (DePrizeState) {
        return _deprizes[deprizeId].state;
    }

    /// @inheritdoc IDePrizeRegistry
    function deprizeIdByJBProject(uint256 jbProjectId) external view override returns (uint256) {
        return _deprizeIdByJBProject[jbProjectId];
    }

    /// @inheritdoc IDePrizeRegistry
    function getDePrize(uint256 deprizeId) external view override returns (DePrize memory) {
        return _get(deprizeId);
    }

    /// @inheritdoc IDePrizeRegistry
    function teamIds(uint256 deprizeId) external view override returns (uint256[] memory) {
        return _get(deprizeId).teamIds;
    }

    /// @inheritdoc IDePrizeRegistry
    function isTeam(uint256 deprizeId, uint256 teamId) external view override returns (bool) {
        return _isTeam[deprizeId][teamId];
    }

    /// @inheritdoc IDePrizeRegistry
    function winningTeamId(uint256 deprizeId) external view override returns (uint256) {
        return _deprizes[deprizeId].winningTeamId;
    }

    /// @inheritdoc IDePrizeRegistry
    function bettingOpen(uint256 deprizeId) external view override returns (bool) {
        DePrize storage d = _deprizes[deprizeId];
        return d.state == DePrizeState.OPEN && d.cancellationNoticeAt == 0;
    }

    /// @inheritdoc IDePrizeRegistry
    function isRefundable(uint256 deprizeId) external view override returns (bool) {
        DePrizeState s = _deprizes[deprizeId].state;
        return s == DePrizeState.CANCELLED || s == DePrizeState.NO_WINNER;
    }

    /// @inheritdoc IDePrizeRegistry
    function isTerminal(uint256 deprizeId) external view override returns (bool) {
        return _isTerminalState(_deprizes[deprizeId].state);
    }

    /// @inheritdoc IDePrizeRegistry
    function cancellationPending(uint256 deprizeId) external view override returns (bool) {
        return _deprizes[deprizeId].cancellationNoticeAt != 0;
    }

    /// @inheritdoc IDePrizeRegistry
    function count() external view override returns (uint256) {
        return _nextId - 1;
    }

    /// @inheritdoc IDePrizeRegistry
    function supersededBy(uint256 deprizeId) external view override returns (uint256) {
        return _supersededBy[deprizeId];
    }

    /// @inheritdoc IDePrizeRegistry
    function supersedes(uint256 deprizeId) external view override returns (uint256) {
        return _supersedes[deprizeId];
    }

    // ---------------------------------------------------------------------
    // Internal helpers
    // ---------------------------------------------------------------------

    function _create(uint256 jbProjectId, uint256[] calldata teamIds_, uint256 sunset)
        private
        returns (uint256 deprizeId)
    {
        deprizeId = _nextId++;
        DePrize storage d = _deprizes[deprizeId];
        d.jbProjectId = jbProjectId;
        d.sunset = sunset;
        d.state = DePrizeState.DRAFT;
        _writeRoster(deprizeId, d, teamIds_);
    }

    function _writeRoster(uint256 deprizeId, DePrize storage d, uint256[] calldata teamIds_) private {
        if (teamIds_.length < 2) revert TooFewTeams(teamIds_.length);
        for (uint256 i = 0; i < teamIds_.length; i++) {
            uint256 teamId = teamIds_[i];
            if (teamId == 0) revert ZeroTeamId();
            if (_isTeam[deprizeId][teamId]) revert DuplicateTeam(teamId);
            _isTeam[deprizeId][teamId] = true;
            d.teamIds.push(teamId);
        }
    }

    function _get(uint256 deprizeId) private view returns (DePrize storage d) {
        d = _deprizes[deprizeId];
        if (d.state == DePrizeState.NONE) revert UnknownDePrize(deprizeId);
    }

    function _requireState(uint256 deprizeId, DePrizeState expected) private view returns (DePrize storage d) {
        d = _get(deprizeId);
        if (d.state != expected) revert InvalidState(deprizeId, d.state);
    }

    function _clearNotice(uint256 deprizeId, DePrize storage d) private {
        if (d.cancellationNoticeAt != 0) {
            d.cancellationNoticeAt = 0;
            emit CancellationAborted(deprizeId);
        }
    }

    function _setState(uint256 deprizeId, DePrize storage d, DePrizeState to) private {
        DePrizeState from = d.state;
        d.state = to;
        emit StateChanged(deprizeId, from, to);
    }

    function _isTerminalState(DePrizeState s) private pure returns (bool) {
        // SUPERSEDED is terminal (stops bets and new contributions) but
        // deliberately NOT refundable — see isRefundable.
        return s == DePrizeState.SETTLED || s == DePrizeState.NO_WINNER || s == DePrizeState.CANCELLED
            || s == DePrizeState.SUPERSEDED;
    }
}
