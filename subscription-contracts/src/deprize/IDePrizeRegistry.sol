// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IDePrizeRegistry
/// @notice On-chain source of truth for the DePrize lifecycle. DePrizeMint,
///         DePrizeRedeem and the registry-aware Launchpad pay hooks read state
///         from here. Dependency-free so the rest of the system compiles against
///         a stable surface.
interface IDePrizeRegistry {
    /// @notice Lifecycle state of a single DePrize.
    /// @dev `NONE` is the zero value so an unset mapping entry reads as "not registered".
    ///      DePrize ids are assigned starting at 1; id 0 means "no DePrize".
    ///
    ///      Prize payment is off-chain (the admin Safe buys a community payload
    ///      from the Juicebox pool), so there are no milestone states. SETTLED is
    ///      the success terminal.
    enum DePrizeState {
        NONE, //       0: not registered
        DRAFT, //      1: registered, still being configured (CTF condition, teams, sunset)
        OPEN, //       2: accepting bets
        LOCKED, //     3: bets closed, awaiting winner determination
        SETTLED, //    4: winner declared — success terminal
        NO_WINNER, //  5: no eligible winner — refund terminal
        CANCELLED, //  6: admin-cancelled after notice — refund terminal
        SUPERSEDED //  7: generation forked; terminal but NOT refundable
    }

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
    /// @dev A DRAFT roster edit, NOT a new registration — indexers must not
    ///      treat this as creating a DePrize.
    event TeamsUpdated(uint256 indexed deprizeId, uint256[] teamIds);
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
    /// @dev setSunset while OPEN may only push the deadline later, never earlier.
    error SunsetNotExtended(uint256 current, uint256 proposed);

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

    /// @notice Set the Gnosis ConditionalTokens condition id. Required before opening. DRAFT only.
    function setCondition(uint256 deprizeId, bytes32 ctfConditionId) external;

    /// @notice Update the sunset timestamp. Allowed in DRAFT (any future value) and
    ///         in OPEN (extend-only). Shortening while OPEN is forbidden so the
    ///         deadline cannot be pulled in on bettors.
    function setSunset(uint256 deprizeId, uint256 sunset) external;

    /// @notice Replace the roster while still in DRAFT. Re-runs every `register` validation.
    function setTeams(uint256 deprizeId, uint256[] calldata teamIds) external;

    /// @notice Fork this DePrize onto a new roster while keeping the Juicebox project
    ///         (and therefore the prize pool + project token) intact. Allowed only from
    ///         OPEN or LOCKED. Creates a new DRAFT entry, moves this entry to SUPERSEDED
    ///         (terminal but NOT refundable), and rebinds `deprizeIdByJBProject` atomically.
    function supersede(uint256 oldDeprizeId, uint256[] calldata newTeamIds, uint256 sunset)
        external
        returns (uint256 newDeprizeId);

    // ---------------------------------------------------------------------
    // Admin: lifecycle transitions
    // ---------------------------------------------------------------------

    function open(uint256 deprizeId) external; //                                  DRAFT -> OPEN
    function lock(uint256 deprizeId) external; //                                   OPEN -> LOCKED
    function settleWinner(uint256 deprizeId, uint256 winningTeamId) external; //    LOCKED -> SETTLED
    function settleNoWinner(uint256 deprizeId) external; //                         LOCKED -> NO_WINNER

    // ---------------------------------------------------------------------
    // Admin: cancellation (7-day notice)
    // ---------------------------------------------------------------------

    /// @notice Announce intent to cancel. Starts the notice window and closes betting.
    function announceCancellation(uint256 deprizeId) external;

    /// @notice Abort a pending cancellation announcement.
    function abortCancellation(uint256 deprizeId) external;

    /// @notice Execute the cancellation once the notice window has elapsed.
    function cancel(uint256 deprizeId) external; //                                 non-terminal -> CANCELLED

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    /// @notice Duration of the cancellation notice window.
    function CANCELLATION_NOTICE() external view returns (uint256);

    /// @notice Current state of a DePrize (NONE if not registered).
    function state(uint256 deprizeId) external view returns (DePrizeState);

    /// @notice Reverse lookup: the DePrize bound to a Juicebox project (0 if none).
    function deprizeIdByJBProject(uint256 jbProjectId) external view returns (uint256);

    /// @notice Full DePrize record. Reverts for unknown ids.
    function getDePrize(uint256 deprizeId) external view returns (DePrize memory);

    /// @notice The competing team ids for a DePrize.
    function teamIds(uint256 deprizeId) external view returns (uint256[] memory);

    /// @notice Whether a team id is part of a DePrize.
    function isTeam(uint256 deprizeId, uint256 teamId) external view returns (bool);

    /// @notice The declared winner (0 until SETTLED).
    function winningTeamId(uint256 deprizeId) external view returns (uint256);

    /// @notice True while bets should be accepted (OPEN and no cancellation pending).
    function bettingOpen(uint256 deprizeId) external view returns (bool);

    /// @notice True for terminal refund states (CANCELLED, NO_WINNER).
    function isRefundable(uint256 deprizeId) external view returns (bool);

    /// @notice True for any terminal state (SETTLED, NO_WINNER, CANCELLED, SUPERSEDED).
    function isTerminal(uint256 deprizeId) external view returns (bool);

    /// @notice True if a cancellation has been announced and not yet aborted/executed.
    function cancellationPending(uint256 deprizeId) external view returns (bool);

    /// @notice Total number of registered DePrizes.
    function count() external view returns (uint256);

    /// @notice The generation that superseded this DePrize (0 if none).
    function supersededBy(uint256 deprizeId) external view returns (uint256);

    /// @notice The generation this DePrize superseded (0 if this is generation 1).
    function supersedes(uint256 deprizeId) external view returns (uint256);
}
