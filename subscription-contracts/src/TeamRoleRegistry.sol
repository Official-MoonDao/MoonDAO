// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {MoonDAOTeam} from "./ERC5643.sol";

/**
 * @title TeamRoleRegistry
 * @notice On-chain role registry that replaces Hats Protocol as the authorization
 *         source of truth for MoonDAO teams (and projects, which are teams under the hood).
 *
 *         Feature contracts (JobBoardTable, MarketplaceTable, MissionTable, MissionCreator,
 *         TeamTableV2) call `isManager(teamId, sender)` with the exact same signature as
 *         `MoonDAOTeam.isManager`, so they can be repointed at this registry via their
 *         existing `setMoonDaoTeam` / `setMoonDAOTeam` owner-only setters without any
 *         redeployment or data migration.
 *
 *         Teams created through the V2 creators are flagged `registryBased` and resolve
 *         roles purely from this contract. Legacy teams (created via the hats-based creator)
 *         are not flagged and transparently fall back to `MoonDAOTeam.isManager` (hats).
 */
contract TeamRoleRegistry is Ownable {
    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableSet for EnumerableSet.UintSet;

    uint8 public constant NONE = 0;
    uint8 public constant MEMBER = 1;
    uint8 public constant MANAGER = 2;

    MoonDAOTeam public moonDAOTeam;

    // teamId => member => role
    mapping(uint256 => mapping(address => uint8)) public roles;

    // teamId => enumerable set of addresses that currently hold any role
    mapping(uint256 => EnumerableSet.AddressSet) private _members;

    // account => enumerable set of teamIds the account holds any role in (reverse index)
    mapping(address => EnumerableSet.UintSet) private _accountTeams;

    // teamId => whether this team resolves roles from the registry (true) or falls back to hats (false)
    mapping(uint256 => bool) public registryBased;

    // Privileged callers (V2 creators, migration scripts, super managers) that may write any role
    mapping(address => bool) public operators;

    event RoleSet(uint256 indexed teamId, address indexed account, uint8 role);
    event RegistryBasedSet(uint256 indexed teamId, bool enabled);
    event OperatorSet(address indexed operator, bool enabled);

    constructor(address _moonDAOTeam) Ownable(msg.sender) {
        moonDAOTeam = MoonDAOTeam(_moonDAOTeam);
    }

    function setMoonDAOTeam(address _moonDAOTeam) external onlyOwner {
        moonDAOTeam = MoonDAOTeam(_moonDAOTeam);
    }

    function setOperator(address operator, bool enabled) external onlyOwner {
        operators[operator] = enabled;
        emit OperatorSet(operator, enabled);
    }

    // ---------------------------------------------------------------------
    // Authorization helpers
    // ---------------------------------------------------------------------

    /// @dev The team admin is the Gnosis Safe that owns the team NFT.
    function _teamAdmin(uint256 teamId) internal view returns (address) {
        try moonDAOTeam.ownerOf(teamId) returns (address teamOwner) {
            return teamOwner;
        } catch {
            return address(0);
        }
    }

    function _isPrivileged(address account) internal view returns (bool) {
        return account == owner() || operators[account];
    }

    // ---------------------------------------------------------------------
    // Role reads (drop-in replacement for MoonDAOTeam.isManager)
    // ---------------------------------------------------------------------

    /**
     * @notice Returns true when `sender` may manage `teamId`.
     * @dev For registry-based teams this reads the roles mapping. For legacy teams it
     *      falls back to the hats-based `MoonDAOTeam.isManager`, which reverts (rather
     *      than returning false) for non-managers, so the call is wrapped in try/catch.
     */
    function isManager(uint256 teamId, address sender) external view returns (bool) {
        if (registryBased[teamId]) {
            return roles[teamId][sender] >= MANAGER || _isPrivileged(sender);
        }
        try moonDAOTeam.isManager(teamId, sender) returns (bool result) {
            return result;
        } catch {
            return false;
        }
    }

    function isMember(uint256 teamId, address account) external view returns (bool) {
        if (registryBased[teamId]) {
            return roles[teamId][account] >= MEMBER;
        }
        // Legacy teams do not expose a boolean member check on-chain; treat managers as members.
        try moonDAOTeam.isManager(teamId, account) returns (bool result) {
            return result;
        } catch {
            return false;
        }
    }

    function getRole(uint256 teamId, address account) external view returns (uint8) {
        return roles[teamId][account];
    }

    function getMembers(uint256 teamId) external view returns (address[] memory) {
        return _members[teamId].values();
    }

    function getMemberCount(uint256 teamId) external view returns (uint256) {
        return _members[teamId].length();
    }

    /// @notice All teams the account currently holds any role in (reverse index).
    function getTeamsForAccount(address account) external view returns (uint256[] memory) {
        return _accountTeams[account].values();
    }

    // ---------------------------------------------------------------------
    // Role writes
    // ---------------------------------------------------------------------

    /**
     * @notice Marks a team as registry-based. Once set, roles are resolved from this
     *         contract instead of hats. Called by a V2 creator at mint time.
     */
    function setRegistryBased(uint256 teamId, bool enabled) external {
        require(_isPrivileged(msg.sender), "Only operator or owner");
        registryBased[teamId] = enabled;
        emit RegistryBasedSet(teamId, enabled);
    }

    /**
     * @notice Grant or revoke the MANAGER role.
     * @dev Authorized: privileged callers, or the team admin (the Gnosis Safe owner).
     */
    function setManager(uint256 teamId, address account, bool enabled) external {
        require(_isPrivileged(msg.sender) || msg.sender == _teamAdmin(teamId), "Only admin/operator");
        _setRole(teamId, account, enabled ? MANAGER : NONE);
    }

    /**
     * @notice Grant or revoke the MEMBER role.
     * @dev Authorized: privileged callers, the team admin, or an existing manager.
     */
    function setMember(uint256 teamId, address account, bool enabled) external {
        require(
            _isPrivileged(msg.sender) ||
                msg.sender == _teamAdmin(teamId) ||
                roles[teamId][msg.sender] >= MANAGER,
            "Only manager/admin/operator"
        );
        // Never silently demote an existing manager through the member setter.
        if (!enabled && roles[teamId][account] > MEMBER) {
            revert("Use setManager to change a manager");
        }
        _setRole(teamId, account, enabled ? MEMBER : NONE);
    }

    /**
     * @notice Directly set a role. Privileged callers only (used by creators during mint).
     */
    function setRole(uint256 teamId, address account, uint8 role) external {
        require(_isPrivileged(msg.sender), "Only operator or owner");
        require(role <= MANAGER, "Invalid role");
        _setRole(teamId, account, role);
    }

    function _setRole(uint256 teamId, address account, uint8 role) internal {
        require(account != address(0), "Zero address");
        roles[teamId][account] = role;
        if (role == NONE) {
            _members[teamId].remove(account);
            _accountTeams[account].remove(teamId);
        } else {
            _members[teamId].add(account);
            _accountTeams[account].add(teamId);
        }
        emit RoleSet(teamId, account, role);
    }
}
