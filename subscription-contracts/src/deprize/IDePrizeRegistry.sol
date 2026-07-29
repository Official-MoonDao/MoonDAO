// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IDePrizeRegistry
/// @notice On-chain source of truth for the DePrize (Overview Prize) lifecycle.
///         Every other DePrize contract (Mint, PrizeEscrow, MilestoneEscrow,
///         Reporter, FeeHook) and the registry-aware LaunchPadPayHook read state
///         from here. This interface is intentionally dependency-free so the rest
///         of the system can compile against a stable surface.
interface IDePrizeRegistry {
    /// @notice Lifecycle state of a single DePrize.
    /// @dev `NONE` is the zero value so an unset mapping entry reads as "not registered".
    ///      DePrize ids are assigned starting at 1; id 0 means "no DePrize".
    enum DePrizeState {
        NONE, //          0: not registered
        DRAFT, //         1: registered, still being configured (CTF condition, teams, sunset)
        OPEN, //          2: accepting bets
        LOCKED, //        3: bets closed, awaiting winner determination
        VOTING, //        4: Senate winner vote in progress
        SETTLED, //       5: winner declared; M1 milestone releasable
        M1_RELEASED, //   6: 30% milestone released to the winning provider
        M2_COMPLETE, //   7: flight delivered, 70% released — success terminal
        M2_FAILED, //     8: post-M1 delivery failed — refund terminal
        CANCELLED, //     9: admin-cancelled after notice — refund terminal
        NO_WINNER, //    10: no eligible winner / vote failed — refund terminal
        SUPERSEDED //    11: generation forked; terminal but NOT refundable
    }

    /// @notice Immutable-ish configuration + mutable lifecycle data for a DePrize.
    struct DePrize {
        uint256 jbProjectId; //          Juicebox project the prize pool tops up.
        bytes32 ctfConditionId; //       Gnosis ConditionalTokens condition id for the outcome set.
        uint256 sunset; //               Timestamp after which the DePrize may be locked/settled.
        uint256 winningTeamId; //        Set on settleWinner; 0 until then.
        uint256 cancellationNoticeAt; // Timestamp a cancellation was announced; 0 if none pending.
        DePrizeState state; //           Current lifecycle state.
        uint256[] teamIds; //            Competing MoonDAOTeam token ids (outcome slots).
    }

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    event DePrizeRegistered(uint256 indexed deprizeId, uint256 indexed jbProjectId, uint256[] teamIds, uint256 sunset);
    event ConditionSet(uint256 indexed deprizeId, bytes32 ctfConditionId);
    event SunsetUpdated(uint256 indexed deprizeId, uint256 sunset);
    event StateChanged(uint256 indexed deprizeId, DePrizeState indexed from, DePrizeState indexed to);
    event WinnerDeclared(uint256 indexed deprizeId, uint256 indexed winningTeamId);
    event CancellationAnnounced(uint256 indexed deprizeId, uint256 noticeAt, uint256 executableAt);
    event CancellationAborted(uint256 indexed deprizeId);
    event ProviderPayoutAddressSet(uint256 indexed deprizeId, address indexed provider);
    /// @dev A DRAFT roster edit, NOT a new registration — indexers must not
    ///      treat this as creating a DePrize.
    event TeamsUpdated(uint256 indexed deprizeId, uint256[] teamIds);
    event TeamWithdrawn(uint256 indexed deprizeId, uint256 indexed teamId);
    event TeamReinstated(uint256 indexed deprizeId, uint256 indexed teamId);
    event DePrizeSuperseded(uint256 indexed oldDeprizeId, uint256 indexed newDeprizeId, uint256[] newTeamIds);

    // ---------------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------------

    error UnknownDePrize(uint256 deprizeId);
    error InvalidState(uint256 deprizeId, DePrizeState current);
    error JBProjectAlreadyBound(uint256 jbProjectId);
    error ConditionNotSet(uint256 deprizeId);
    error TooFewTeams(uint256 provided);
    error DuplicateTeam(uint256 teamId);
    /// @dev Team id 0 is reserved: `winningTeamId() == 0` is the "no winner declared" sentinel.
    error ZeroTeamId();
    error UnknownTeam(uint256 deprizeId, uint256 teamId);
    error InvalidJBProject();
    error InvalidSunset();
    error NoCancellationPending(uint256 deprizeId);
    error CancellationAlreadyPending(uint256 deprizeId);
    error CancellationNoticeNotElapsed(uint256 deprizeId, uint256 executableAt);
    /// @dev The provider payout address must be non-zero (M5 prize disbursement target).
    error ZeroProviderAddress();
    /// @dev setSunset while OPEN may only push the deadline later, never earlier.
    error SunsetNotExtended(uint256 current, uint256 proposed);
    /// @dev markWithdrawn / unmarkWithdrawn on a team that is not on the roster.
    error TeamNotOnRoster(uint256 deprizeId, uint256 teamId);

    // ---------------------------------------------------------------------
    // Admin: registration & configuration
    // ---------------------------------------------------------------------

    /// @notice Register a new DePrize in DRAFT state.
    /// @param jbProjectId The Juicebox project whose prize pool this DePrize tops up.
    /// @param teamIds The competing MoonDAOTeam token ids (>= 2 required).
    /// @param sunset Timestamp after which the DePrize may be locked/settled.
    /// @return deprizeId The newly assigned id (>= 1).
    function register(uint256 jbProjectId, uint256[] calldata teamIds, uint256 sunset)
        external
        returns (uint256 deprizeId);

    /// @notice Set the Gnosis ConditionalTokens condition id. Required before opening.
    function setCondition(uint256 deprizeId, bytes32 ctfConditionId) external;

    /// @notice Update the sunset timestamp. Allowed in DRAFT (any future value) and
    ///         in OPEN (extend-only — the new sunset must be strictly later than the
    ///         current one). Shortening while OPEN is forbidden so the deadline cannot
    ///         be pulled in on bettors.
    function setSunset(uint256 deprizeId, uint256 sunset) external;

    /// @notice Replace the roster while still in DRAFT. Clears and rewrites `_isTeam`.
    ///         Re-runs every `register` validation (`TooFewTeams`, `ZeroTeamId`,
    ///         `DuplicateTeam`). Fixes an unrecoverable typo without costing the
    ///         Juicebox project binding.
    function setTeams(uint256 deprizeId, uint256[] calldata teamIds) external;

    /// @notice Fork this DePrize onto a new roster while keeping the Juicebox project
    ///         (and therefore the prize pool + project token) intact. Allowed only from
    ///         OPEN or LOCKED. Creates a new DRAFT entry, moves this entry to SUPERSEDED
    ///         (terminal but NOT refundable — cashOut must never open), and rebinds
    ///         `deprizeIdByJBProject` atomically.
    function supersede(uint256 oldDeprizeId, uint256[] calldata newTeamIds, uint256 sunset)
        external
        returns (uint256 newDeprizeId);

    /// @notice Mark a competitor withdrawn. Disclosure only — does NOT gate `bet`, so
    ///         holders of that outcome can still exit. Valid in any non-terminal state.
    function markWithdrawn(uint256 deprizeId, uint256 teamId) external;

    /// @notice Clear a withdrawn mark.
    function unmarkWithdrawn(uint256 deprizeId, uint256 teamId) external;

    // ---------------------------------------------------------------------
    // Admin: lifecycle transitions
    // ---------------------------------------------------------------------

    function open(uint256 deprizeId) external; //                       DRAFT -> OPEN
    function lock(uint256 deprizeId) external; //                        OPEN -> LOCKED
    function startVote(uint256 deprizeId) external; //                   LOCKED -> VOTING
    function settleWinner(uint256 deprizeId, uint256 winningTeamId) external; // LOCKED|VOTING -> SETTLED
    function settleNoWinner(uint256 deprizeId) external; //              LOCKED|VOTING -> NO_WINNER
    function releaseM1(uint256 deprizeId) external; //                   SETTLED -> M1_RELEASED
    function completeM2(uint256 deprizeId) external; //                  M1_RELEASED -> M2_COMPLETE
    function failM2(uint256 deprizeId) external; //                      M1_RELEASED -> M2_FAILED

    // ---------------------------------------------------------------------
    // Admin: cancellation (7-day notice)
    // ---------------------------------------------------------------------

    /// @notice Announce intent to cancel. Starts the notice window and flags bets to pause.
    function announceCancellation(uint256 deprizeId) external;

    /// @notice Abort a pending cancellation announcement.
    function abortCancellation(uint256 deprizeId) external;

    /// @notice Execute the cancellation once the notice window has elapsed.
    function cancel(uint256 deprizeId) external; //                      non-terminal -> CANCELLED

    // ---------------------------------------------------------------------
    // Admin: prize disbursement (M5)
    // ---------------------------------------------------------------------

    /// @notice Record the winning provider's payout address (the Safe that receives
    ///         the 30%/70% milestone prize). Settable only once a winner has been
    ///         declared and before the prize fully resolves (`SETTLED` or
    ///         `M1_RELEASED`), so the disbursement runbook has an on-chain,
    ///         auditable target. Updatable while in those states (e.g. the provider
    ///         rotates Safes between M1 and M2).
    /// @dev The actual prize ETH lives in the admin Safe (extracted from Juicebox);
    ///      disbursement is a Safe transaction, not an on-chain pull. This only
    ///      records the destination. See DEPRIZE_M5.md.
    function setProviderPayoutAddress(uint256 deprizeId, address provider) external;

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    /// @notice The recorded provider payout address (0 if unset).
    function providerPayoutAddress(uint256 deprizeId) external view returns (address);

    /// @notice Duration of the cancellation notice window.
    function CANCELLATION_NOTICE() external view returns (uint256);

    /// @notice Current state of a DePrize (NONE if not registered).
    function state(uint256 deprizeId) external view returns (DePrizeState);

    /// @notice Reverse lookup: the DePrize bound to a Juicebox project (0 if none).
    function deprizeIdByJBProject(uint256 jbProjectId) external view returns (uint256);

    /// @notice Full DePrize record.
    function getDePrize(uint256 deprizeId) external view returns (DePrize memory);

    /// @notice The competing team ids for a DePrize.
    function teamIds(uint256 deprizeId) external view returns (uint256[] memory);

    /// @notice Whether a team id is part of a DePrize.
    function isTeam(uint256 deprizeId, uint256 teamId) external view returns (bool);

    /// @notice True once a winner has been declared (SETTLED or later non-refund state).
    function winningTeamId(uint256 deprizeId) external view returns (uint256);

    /// @notice True while bets should be accepted (OPEN and no cancellation pending).
    function bettingOpen(uint256 deprizeId) external view returns (bool);

    /// @notice True for terminal refund states (CANCELLED, NO_WINNER, M2_FAILED).
    function isRefundable(uint256 deprizeId) external view returns (bool);

    /// @notice True for any terminal state (success or refund).
    function isTerminal(uint256 deprizeId) external view returns (bool);

    /// @notice True if a cancellation has been announced and not yet aborted/executed.
    function cancellationPending(uint256 deprizeId) external view returns (bool);

    /// @notice Total number of registered DePrizes.
    function count() external view returns (uint256);

    /// @notice Whether a competitor has been marked withdrawn (disclosure flag).
    function withdrawn(uint256 deprizeId, uint256 teamId) external view returns (bool);

    /// @notice The generation that superseded this DePrize (0 if none).
    function supersededBy(uint256 deprizeId) external view returns (uint256);

    /// @notice The generation this DePrize superseded (0 if this is generation 1).
    function supersedes(uint256 deprizeId) external view returns (uint256);
}
