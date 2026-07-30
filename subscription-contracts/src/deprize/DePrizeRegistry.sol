// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IDePrizeRegistry} from "./IDePrizeRegistry.sol";

/// @title DePrizeRegistry
/// @notice On-chain state machine and source of truth for the DePrize (Overview
///         Prize) lifecycle. Other DePrize contracts read state from here so the
///         system has a single, authoritative lifecycle.
///
/// @dev Lifecycle (see IDePrizeRegistry.DePrizeState):
///
///   register() ──► DRAFT ──open──► OPEN ──lock──► LOCKED ──startVote──► VOTING
///                                                    │                     │
///                                                    └──────settleWinner───┤
///                                                                          ▼
///                                                                       SETTLED
///                                                                          │
///                                                                      releaseM1
///                                                                          ▼
///                                                                     M1_RELEASED
///                                                                       │     │
///                                                              completeM2     failM2
///                                                                     ▼         ▼
///                                                            M2_COMPLETE   M2_FAILED
///
///   settleNoWinner: LOCKED|VOTING ──► NO_WINNER
///   cancel:         any non-terminal ──► CANCELLED (after CANCELLATION_NOTICE)
///
///   Refund-enabling terminals: CANCELLED, NO_WINNER, M2_FAILED.
///   Success terminal: M2_COMPLETE.
///
/// Access control is a single owner (the admin Safe) for v1. The contract is
/// UUPS-upgradeable; a timelocked upgrade path is a later milestone.
contract DePrizeRegistry is Initializable, OwnableUpgradeable, UUPSUpgradeable, IDePrizeRegistry {
    /// @inheritdoc IDePrizeRegistry
    uint256 public constant override CANCELLATION_NOTICE = 7 days;

    uint256 private _nextId;
    mapping(uint256 => DePrize) private _deprizes;
    mapping(uint256 => uint256) private _deprizeIdByJBProject;
    mapping(uint256 => mapping(uint256 => bool)) private _isTeam;

    /// @dev M5: winning provider's payout destination (set post-settlement). Stored
    ///      as a standalone mapping rather than a `DePrize` struct field so the
    ///      `getDePrize` return ABI is unchanged for existing consumers, and so this
    ///      upgrade only consumes one previously-reserved gap slot.
    mapping(uint256 => address) private _providerPayoutAddress;

    /// @dev Disclosure flag: competitor marked withdrawn. Does NOT gate betting —
    ///      holders must still be able to exit. Consumes one gap slot.
    mapping(uint256 => mapping(uint256 => bool)) private _withdrawn;

    /// @dev Generation lineage. `supersededBy[old] = new` and `supersedes[new] = old`.
    ///      Two gap slots. Walk `supersededBy` forward to find the live generation.
    mapping(uint256 => uint256) private _supersededBy;
    mapping(uint256 => uint256) private _supersedes;

    /// @dev Storage gap for future upgrades (50 slots - 8 used = 42).
    uint256[42] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address owner_) external initializer {
        __Ownable_init(owner_);
        __UUPSUpgradeable_init();
        _nextId = 1;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

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
        if (teamIds_.length < 2) revert TooFewTeams(teamIds_.length);
        if (sunset <= block.timestamp) revert InvalidSunset();

        deprizeId = _nextId++;

        DePrize storage d = _deprizes[deprizeId];
        d.jbProjectId = jbProjectId;
        d.sunset = sunset;
        d.state = DePrizeState.DRAFT;

        for (uint256 i = 0; i < teamIds_.length; i++) {
            uint256 teamId = teamIds_[i];
            // 0 is reserved as the "no winner declared" sentinel for winningTeamId.
            if (teamId == 0) revert ZeroTeamId();
            if (_isTeam[deprizeId][teamId]) revert DuplicateTeam(teamId);
            _isTeam[deprizeId][teamId] = true;
            d.teamIds.push(teamId);
        }

        _deprizeIdByJBProject[jbProjectId] = deprizeId;

        emit DePrizeRegistered(deprizeId, jbProjectId, teamIds_, sunset);
        emit StateChanged(deprizeId, DePrizeState.NONE, DePrizeState.DRAFT);
    }

    /// @inheritdoc IDePrizeRegistry
    function setCondition(uint256 deprizeId, bytes32 ctfConditionId) external override onlyOwner {
        DePrize storage d = _requireDraft(deprizeId);
        d.ctfConditionId = ctfConditionId;
        emit ConditionSet(deprizeId, ctfConditionId);
    }

    /// @inheritdoc IDePrizeRegistry
    function setSunset(uint256 deprizeId, uint256 sunset) external override onlyOwner {
        DePrize storage d = _get(deprizeId);
        if (sunset <= block.timestamp) revert InvalidSunset();
        if (d.state == DePrizeState.DRAFT) {
            // Any future sunset is fine in DRAFT.
        } else if (d.state == DePrizeState.OPEN) {
            // Extend-only: cannot pull the deadline in on bettors.
            if (sunset <= d.sunset) revert SunsetNotExtended(d.sunset, sunset);
        } else {
            revert InvalidState(deprizeId, d.state);
        }
        d.sunset = sunset;
        emit SunsetUpdated(deprizeId, sunset);
    }

    /// @inheritdoc IDePrizeRegistry
    function setTeams(uint256 deprizeId, uint256[] calldata teamIds_) external override onlyOwner {
        DePrize storage d = _requireDraft(deprizeId);
        if (teamIds_.length < 2) revert TooFewTeams(teamIds_.length);

        // Clear-then-write: stale _isTeam entries would otherwise survive and
        // let settleWinner accept a team that is no longer on the roster.
        uint256 oldLen = d.teamIds.length;
        for (uint256 i = 0; i < oldLen; i++) {
            _isTeam[deprizeId][d.teamIds[i]] = false;
            // A withdrawn mark on a removed team is meaningless; clear it too.
            _withdrawn[deprizeId][d.teamIds[i]] = false;
        }
        delete d.teamIds;

        for (uint256 i = 0; i < teamIds_.length; i++) {
            uint256 teamId = teamIds_[i];
            if (teamId == 0) revert ZeroTeamId();
            if (_isTeam[deprizeId][teamId]) revert DuplicateTeam(teamId);
            _isTeam[deprizeId][teamId] = true;
            d.teamIds.push(teamId);
        }

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
        if (newTeamIds.length < 2) revert TooFewTeams(newTeamIds.length);
        if (sunset <= block.timestamp) revert InvalidSunset();

        // Abort any pending cancellation so the notice doesn't linger on a
        // SUPERSEDED entry (betting is already closed by the terminal state).
        if (old.cancellationNoticeAt != 0) {
            old.cancellationNoticeAt = 0;
            emit CancellationAborted(oldDeprizeId);
        }

        uint256 jbProjectId = old.jbProjectId;

        // Create the new generation in DRAFT, reusing the Juicebox project.
        newDeprizeId = _nextId++;
        DePrize storage neu = _deprizes[newDeprizeId];
        neu.jbProjectId = jbProjectId;
        neu.sunset = sunset;
        neu.state = DePrizeState.DRAFT;

        for (uint256 i = 0; i < newTeamIds.length; i++) {
            uint256 teamId = newTeamIds[i];
            if (teamId == 0) revert ZeroTeamId();
            if (_isTeam[newDeprizeId][teamId]) revert DuplicateTeam(teamId);
            _isTeam[newDeprizeId][teamId] = true;
            neu.teamIds.push(teamId);
        }

        // Lineage + rebind. Order matters for the cashOut hazard: the old entry
        // must be SUPERSEDED (terminal, not refundable) BEFORE the JB mapping
        // points at the new DRAFT, so the pay hook never sees a refundable
        // DePrize on a funded project.
        _supersededBy[oldDeprizeId] = newDeprizeId;
        _supersedes[newDeprizeId] = oldDeprizeId;
        _setState(oldDeprizeId, old, DePrizeState.SUPERSEDED);
        _deprizeIdByJBProject[jbProjectId] = newDeprizeId;

        emit DePrizeRegistered(newDeprizeId, jbProjectId, newTeamIds, sunset);
        emit StateChanged(newDeprizeId, DePrizeState.NONE, DePrizeState.DRAFT);
        emit DePrizeSuperseded(oldDeprizeId, newDeprizeId, newTeamIds);
    }

    /// @inheritdoc IDePrizeRegistry
    function markWithdrawn(uint256 deprizeId, uint256 teamId) external override onlyOwner {
        DePrize storage d = _get(deprizeId);
        if (_isTerminalState(d.state)) revert InvalidState(deprizeId, d.state);
        if (!_isTeam[deprizeId][teamId]) revert TeamNotOnRoster(deprizeId, teamId);
        _withdrawn[deprizeId][teamId] = true;
        emit TeamWithdrawn(deprizeId, teamId);
    }

    /// @inheritdoc IDePrizeRegistry
    function unmarkWithdrawn(uint256 deprizeId, uint256 teamId) external override onlyOwner {
        DePrize storage d = _get(deprizeId);
        if (_isTerminalState(d.state)) revert InvalidState(deprizeId, d.state);
        if (!_isTeam[deprizeId][teamId]) revert TeamNotOnRoster(deprizeId, teamId);
        _withdrawn[deprizeId][teamId] = false;
        emit TeamReinstated(deprizeId, teamId);
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
    function startVote(uint256 deprizeId) external override onlyOwner {
        DePrize storage d = _requireState(deprizeId, DePrizeState.LOCKED);
        _setState(deprizeId, d, DePrizeState.VOTING);
    }

    /// @inheritdoc IDePrizeRegistry
    function settleWinner(uint256 deprizeId, uint256 winningTeamId_) external override onlyOwner {
        DePrize storage d = _get(deprizeId);
        if (d.state != DePrizeState.LOCKED && d.state != DePrizeState.VOTING) {
            revert InvalidState(deprizeId, d.state);
        }
        if (!_isTeam[deprizeId][winningTeamId_]) revert UnknownTeam(deprizeId, winningTeamId_);
        d.winningTeamId = winningTeamId_;
        if (d.cancellationNoticeAt != 0) {
            d.cancellationNoticeAt = 0;
            emit CancellationAborted(deprizeId);
        }
        _setState(deprizeId, d, DePrizeState.SETTLED);
        emit WinnerDeclared(deprizeId, winningTeamId_);
    }

    /// @inheritdoc IDePrizeRegistry
    function settleNoWinner(uint256 deprizeId) external override onlyOwner {
        DePrize storage d = _get(deprizeId);
        if (d.state != DePrizeState.LOCKED && d.state != DePrizeState.VOTING) {
            revert InvalidState(deprizeId, d.state);
        }
        if (d.cancellationNoticeAt != 0) {
            d.cancellationNoticeAt = 0;
            emit CancellationAborted(deprizeId);
        }
        _setState(deprizeId, d, DePrizeState.NO_WINNER);
    }

    /// @inheritdoc IDePrizeRegistry
    function releaseM1(uint256 deprizeId) external override onlyOwner {
        DePrize storage d = _requireState(deprizeId, DePrizeState.SETTLED);
        if (d.cancellationNoticeAt != 0) {
            d.cancellationNoticeAt = 0;
            emit CancellationAborted(deprizeId);
        }
        _setState(deprizeId, d, DePrizeState.M1_RELEASED);
    }

    /// @inheritdoc IDePrizeRegistry
    function completeM2(uint256 deprizeId) external override onlyOwner {
        DePrize storage d = _requireState(deprizeId, DePrizeState.M1_RELEASED);
        if (d.cancellationNoticeAt != 0) {
            d.cancellationNoticeAt = 0;
            emit CancellationAborted(deprizeId);
        }
        _setState(deprizeId, d, DePrizeState.M2_COMPLETE);
    }

    /// @inheritdoc IDePrizeRegistry
    function failM2(uint256 deprizeId) external override onlyOwner {
        DePrize storage d = _requireState(deprizeId, DePrizeState.M1_RELEASED);
        if (d.cancellationNoticeAt != 0) {
            d.cancellationNoticeAt = 0;
            emit CancellationAborted(deprizeId);
        }
        _setState(deprizeId, d, DePrizeState.M2_FAILED);
    }

    // ---------------------------------------------------------------------
    // Cancellation (7-day notice)
    // ---------------------------------------------------------------------

    /// @inheritdoc IDePrizeRegistry
    function announceCancellation(uint256 deprizeId) external override onlyOwner {
        DePrize storage d = _get(deprizeId);
        if (_isTerminalState(d.state)) {
            revert InvalidState(deprizeId, d.state);
        }
        // Require an explicit abort before re-announcing, so the notice window can't be
        // silently reset (off-chain monitors and bettors track a single executableAt).
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
        // Intentionally preserve winningTeamId: if cancellation happens after
        // SETTLED/M1_RELEASED, downstream refund/settlement paths may need to know
        // which provider had been selected. Pre-settlement it is already 0.
        _setState(deprizeId, d, DePrizeState.CANCELLED);
    }

    // ---------------------------------------------------------------------
    // Prize disbursement (M5)
    // ---------------------------------------------------------------------

    /// @inheritdoc IDePrizeRegistry
    function setProviderPayoutAddress(uint256 deprizeId, address provider) external override onlyOwner {
        if (provider == address(0)) revert ZeroProviderAddress();
        DePrize storage d = _get(deprizeId);
        // Only meaningful once a winner is declared and before the prize fully
        // resolves: SETTLED (pre-M1) or M1_RELEASED (between the two milestones).
        if (d.state != DePrizeState.SETTLED && d.state != DePrizeState.M1_RELEASED) {
            revert InvalidState(deprizeId, d.state);
        }
        _providerPayoutAddress[deprizeId] = provider;
        emit ProviderPayoutAddressSet(deprizeId, provider);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    /// @inheritdoc IDePrizeRegistry
    function providerPayoutAddress(uint256 deprizeId) external view override returns (address) {
        return _providerPayoutAddress[deprizeId];
    }

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
        return s == DePrizeState.CANCELLED || s == DePrizeState.NO_WINNER || s == DePrizeState.M2_FAILED;
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
    function withdrawn(uint256 deprizeId, uint256 teamId) external view override returns (bool) {
        return _withdrawn[deprizeId][teamId];
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

    function _get(uint256 deprizeId) private view returns (DePrize storage d) {
        d = _deprizes[deprizeId];
        if (d.state == DePrizeState.NONE) revert UnknownDePrize(deprizeId);
    }

    function _requireState(uint256 deprizeId, DePrizeState expected) private view returns (DePrize storage d) {
        d = _get(deprizeId);
        if (d.state != expected) revert InvalidState(deprizeId, d.state);
    }

    function _requireDraft(uint256 deprizeId) private view returns (DePrize storage d) {
        return _requireState(deprizeId, DePrizeState.DRAFT);
    }

    function _setState(uint256 deprizeId, DePrize storage d, DePrizeState to) private {
        DePrizeState from = d.state;
        d.state = to;
        emit StateChanged(deprizeId, from, to);
    }

    function _isTerminalState(DePrizeState s) private pure returns (bool) {
        // SUPERSEDED is terminal (stops bets / fee routing to prize pool) but
        // deliberately NOT refundable — see isRefundable.
        return s == DePrizeState.M2_COMPLETE || s == DePrizeState.M2_FAILED || s == DePrizeState.CANCELLED
            || s == DePrizeState.NO_WINNER || s == DePrizeState.SUPERSEDED;
    }
}
