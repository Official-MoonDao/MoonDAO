// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

import {IDePrizeRegistry} from "./IDePrizeRegistry.sol";
import {IJBTerminal} from "@nana-core-v5/interfaces/IJBTerminal.sol";
import {JBConstants} from "@nana-core-v5/libraries/JBConstants.sol";

/// @title DePrizeMilestoneEscrow
/// @notice Holds a DePrize's prize pool after settlement and releases it to the
///         winning provider in two milestones, gated entirely by the
///         `DePrizeRegistry` lifecycle:
///
///           - `releaseM1`  (state == M1_RELEASED):  pays 30% to the provider.
///           - `releaseM2`  (state == M2_COMPLETE):  pays the remainder to the provider.
///           - `returnToTreasury` (state == M2_FAILED): the un-released remainder
///             goes to the MoonDAO treasury for $OVERVIEW-governed re-allocation.
///           - `refundToJB` (state == CANCELLED | NO_WINNER): the balance is
///             returned to the JB project so $OVERVIEW holders can cash out.
///
///         The 30/70 split aligns the provider's incentive with actual delivery
///         (M1 = capability demonstrated, M2 = mission flown). See `DEPRIZE.md`.
///
/// @dev Funding boundary (integration point): this contract releases percentages
///      of its **own per-DePrize ETH balance**. The settlement process is
///      responsible for funding it first — the JB project's prize pool plus any
///      swap-fee accrual (the future `DePrizePrizeEscrow`) are deposited via
///      `deposit(deprizeId)` before `releaseM1` is called. Keeping the escrow
///      agnostic about *where* the ETH came from makes it independently
///      reviewable and testable; the JB payout-routing that funds it is wired
///      separately (a prize mission's ruleset-1 payout, or a manual deposit).
///
///      Release functions are permissionless (keeper-friendly): they are gated
///      by the registry state and the admin-set provider recipient, so anyone
///      can trigger a release once the registry reaches the right state, but the
///      destination is never attacker-controlled. Admin (the same Safe that owns
///      the registry, in v1) sets the provider recipient, JB terminal, and
///      treasury. UUPS-upgradeable to match `DePrizeRegistry`.
contract DePrizeMilestoneEscrow is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable
{
    /// @notice Basis points released at M1 (capability demonstrated).
    uint256 public constant M1_BPS = 3_000; // 30%
    uint256 public constant BPS_DENOMINATOR = 10_000;

    /// @notice The DePrize lifecycle source of truth.
    IDePrizeRegistry public registry;

    /// @notice JB multi-terminal used to return funds to a project on refund.
    IJBTerminal public jbTerminal;

    /// @notice Recipient of forfeited M2 funds when a prize fails post-M1.
    address public moonDAOTreasury;

    /// @notice Total ETH funded into the escrow for a DePrize.
    mapping(uint256 => uint256) public deposited;

    /// @notice Cumulative ETH already paid out for a DePrize.
    mapping(uint256 => uint256) public released;

    /// @notice Winning provider payout address (admin-set once a winner exists).
    mapping(uint256 => address) public providerRecipient;

    /// @notice Whether the M1 (30%) tranche has been released.
    mapping(uint256 => bool) public m1Released;

    /// @notice Whether the DePrize's escrow has reached a final state
    ///         (M2 released / returned to treasury / refunded to JB).
    mapping(uint256 => bool) public finalized;

    event RegistrySet(address indexed registry);
    event JBTerminalSet(address indexed terminal);
    event MoonDAOTreasurySet(address indexed treasury);
    event ProviderRecipientSet(uint256 indexed deprizeId, address indexed recipient);
    event Deposited(uint256 indexed deprizeId, address indexed from, uint256 amount);
    event M1Released(uint256 indexed deprizeId, address indexed recipient, uint256 amount);
    event M2Released(uint256 indexed deprizeId, address indexed recipient, uint256 amount);
    event ReturnedToTreasury(uint256 indexed deprizeId, address indexed treasury, uint256 amount);
    event RefundedToJB(uint256 indexed deprizeId, uint256 indexed jbProjectId, uint256 amount);

    error ZeroAddress();
    error ZeroAmount();
    error UnknownDePrize(uint256 deprizeId);
    error AlreadyFinalized(uint256 deprizeId);
    error WrongState(uint256 deprizeId, IDePrizeRegistry.DePrizeState state);
    error NoWinnerDeclared(uint256 deprizeId);
    error RecipientNotSet(uint256 deprizeId);
    error AlreadyReleasedM1(uint256 deprizeId);
    error TransferFailed();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address owner_, address registry_, address jbTerminal_, address treasury_)
        external
        initializer
    {
        if (owner_ == address(0) || registry_ == address(0) || jbTerminal_ == address(0) || treasury_ == address(0)) {
            revert ZeroAddress();
        }
        __Ownable_init(owner_);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        registry = IDePrizeRegistry(registry_);
        jbTerminal = IJBTerminal(jbTerminal_);
        moonDAOTreasury = treasury_;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // ---------------------------------------------------------------------
    // Admin configuration
    // ---------------------------------------------------------------------

    function setRegistry(address registry_) external onlyOwner {
        if (registry_ == address(0)) revert ZeroAddress();
        registry = IDePrizeRegistry(registry_);
        emit RegistrySet(registry_);
    }

    function setJBTerminal(address terminal_) external onlyOwner {
        if (terminal_ == address(0)) revert ZeroAddress();
        jbTerminal = IJBTerminal(terminal_);
        emit JBTerminalSet(terminal_);
    }

    function setMoonDAOTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroAddress();
        moonDAOTreasury = treasury_;
        emit MoonDAOTreasurySet(treasury_);
    }

    /// @notice Set the winning provider's payout address. Only valid once a winner
    ///         has been declared in the registry, and only before M1 has been
    ///         released (so a release can never be redirected after the fact).
    function setProviderRecipient(uint256 deprizeId, address recipient) external onlyOwner {
        if (recipient == address(0)) revert ZeroAddress();
        if (m1Released[deprizeId]) revert AlreadyReleasedM1(deprizeId);
        if (registry.winningTeamId(deprizeId) == 0) revert NoWinnerDeclared(deprizeId);
        providerRecipient[deprizeId] = recipient;
        emit ProviderRecipientSet(deprizeId, recipient);
    }

    // ---------------------------------------------------------------------
    // Funding
    // ---------------------------------------------------------------------

    /// @notice Fund the escrow for a specific DePrize. Anyone may deposit (the
    ///         settlement flow, the future PrizeEscrow, or a JB payout routed
    ///         here). Reverts for unknown or already-finalized DePrizes so ETH is
    ///         never stranded under an unreleasable id.
    function deposit(uint256 deprizeId) external payable {
        if (msg.value == 0) revert ZeroAmount();
        if (registry.state(deprizeId) == IDePrizeRegistry.DePrizeState.NONE) revert UnknownDePrize(deprizeId);
        if (finalized[deprizeId]) revert AlreadyFinalized(deprizeId);
        deposited[deprizeId] += msg.value;
        emit Deposited(deprizeId, msg.sender, msg.value);
    }

    /// @dev Reject unattributed ETH so every wei is tied to a DePrize.
    receive() external payable {
        revert("use deposit(deprizeId)");
    }

    // ---------------------------------------------------------------------
    // Releases (gated by registry state; permissionless / keeper-friendly)
    // ---------------------------------------------------------------------

    /// @notice Release the 30% M1 tranche to the winning provider once the
    ///         registry reports `M1_RELEASED`.
    function releaseM1(uint256 deprizeId) external nonReentrant {
        IDePrizeRegistry.DePrizeState s = registry.state(deprizeId);
        if (s != IDePrizeRegistry.DePrizeState.M1_RELEASED) {
            revert WrongState(deprizeId, s);
        }
        if (m1Released[deprizeId]) revert AlreadyReleasedM1(deprizeId);
        address recipient = providerRecipient[deprizeId];
        if (recipient == address(0)) revert RecipientNotSet(deprizeId);

        uint256 amount = (deposited[deprizeId] * M1_BPS) / BPS_DENOMINATOR;
        if (amount == 0) revert ZeroAmount();
        m1Released[deprizeId] = true;
        released[deprizeId] += amount;
        _sendETH(recipient, amount);
        emit M1Released(deprizeId, recipient, amount);
    }

    /// @notice Release the remaining balance to the winning provider once the
    ///         registry reports `M2_COMPLETE`.
    function releaseM2(uint256 deprizeId) external nonReentrant {
        IDePrizeRegistry.DePrizeState s = registry.state(deprizeId);
        if (s != IDePrizeRegistry.DePrizeState.M2_COMPLETE) {
            revert WrongState(deprizeId, s);
        }
        if (finalized[deprizeId]) revert AlreadyFinalized(deprizeId);
        address recipient = providerRecipient[deprizeId];
        if (recipient == address(0)) revert RecipientNotSet(deprizeId);

        uint256 amount = deposited[deprizeId] - released[deprizeId];
        finalized[deprizeId] = true;
        released[deprizeId] = deposited[deprizeId];
        _sendETH(recipient, amount);
        emit M2Released(deprizeId, recipient, amount);
    }

    /// @notice Return the un-released remainder to the MoonDAO treasury when a
    ///         prize fails after M1 (`M2_FAILED`) for $OVERVIEW-governed
    ///         re-allocation. The 30% already paid at M1 is not clawed back.
    function returnToTreasury(uint256 deprizeId) external nonReentrant {
        IDePrizeRegistry.DePrizeState s = registry.state(deprizeId);
        if (s != IDePrizeRegistry.DePrizeState.M2_FAILED) {
            revert WrongState(deprizeId, s);
        }
        if (finalized[deprizeId]) revert AlreadyFinalized(deprizeId);

        uint256 amount = deposited[deprizeId] - released[deprizeId];
        finalized[deprizeId] = true;
        released[deprizeId] = deposited[deprizeId];
        _sendETH(moonDAOTreasury, amount);
        emit ReturnedToTreasury(deprizeId, moonDAOTreasury, amount);
    }

    /// @notice Return the escrow balance to the JB project on a refundable,
    ///         pre-provider terminal (`CANCELLED` or `NO_WINNER`), raising the
    ///         $OVERVIEW cashOut value so contributors can reclaim their floor.
    function refundToJB(uint256 deprizeId) external nonReentrant {
        IDePrizeRegistry.DePrizeState s = registry.state(deprizeId);
        if (s != IDePrizeRegistry.DePrizeState.CANCELLED && s != IDePrizeRegistry.DePrizeState.NO_WINNER) {
            revert WrongState(deprizeId, s);
        }
        if (finalized[deprizeId]) revert AlreadyFinalized(deprizeId);

        uint256 projectId = registry.getDePrize(deprizeId).jbProjectId;
        uint256 amount = deposited[deprizeId] - released[deprizeId];
        finalized[deprizeId] = true;
        released[deprizeId] = deposited[deprizeId];

        if (amount > 0) {
            jbTerminal.addToBalanceOf{value: amount}(
                projectId, JBConstants.NATIVE_TOKEN, amount, false, "DePrize refund", bytes("")
            );
        }
        emit RefundedToJB(deprizeId, projectId, amount);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    /// @notice ETH still held by the escrow for a DePrize (deposited − released).
    function pendingBalance(uint256 deprizeId) external view returns (uint256) {
        return deposited[deprizeId] - released[deprizeId];
    }

    // ---------------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------------

    function _sendETH(address to, uint256 amount) private {
        if (amount == 0) return;
        (bool ok,) = payable(to).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
