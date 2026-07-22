// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {TablelandDeployments} from "@evm-tableland/contracts/utils/TablelandDeployments.sol";
import {SQLHelpers} from "@evm-tableland/contracts/utils/SQLHelpers.sol";
import {ERC721Holder} from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import {TeamRoleRegistry} from "../TeamRoleRegistry.sol";

/**
 * @title ProjectV2
 * @notice Governance-lifecycle overlay for projects that are teams under the hood.
 *         Each row is keyed by the underlying `teamId` (the MoonDAOTeam tokenId minted for
 *         the project) and additionally carries a project `id`. Authorization for updates is
 *         delegated to the TeamRoleRegistry, so a project's team manager can maintain the row.
 */
contract ProjectV2 is ERC721Holder, Ownable {
    uint256 private _tableId;
    string private _TABLE_PREFIX;
    TeamRoleRegistry public registry;
    mapping(address => bool) public operators;

    // projectId => teamId
    mapping(uint256 => uint256) public idToTeamId;

    event ProjectInserted(uint256 indexed id, uint256 indexed teamId);
    event ProjectUpdated(uint256 indexed id, uint256 indexed teamId);
    event OperatorSet(address indexed operator, bool enabled);

    modifier onlyOperators() {
        require(msg.sender == owner() || operators[msg.sender], "Only Owner or Operator");
        _;
    }

    constructor(string memory _table_prefix) Ownable(msg.sender) {
        _TABLE_PREFIX = _table_prefix;
        _tableId = TablelandDeployments.get().create(
            address(this),
            SQLHelpers.toCreateFromSchema(
                "id integer primary key,"
                "teamId integer,"
                "name text,"
                "description text,"
                "image text,"
                "quarter integer,"
                "year integer,"
                "MDP integer,"
                "proposalIPFS text,"
                "proposalLink text,"
                "finalReportIPFS text,"
                "finalReportLink text,"
                "rewardDistribution text,"
                "upfrontPayments text,"
                "active integer,"
                "eligible integer",
                _TABLE_PREFIX
            )
        );
    }

    function setRegistry(address _registry) external onlyOwner {
        registry = TeamRoleRegistry(_registry);
    }

    function setOperator(address operator, bool enabled) external onlyOwner {
        operators[operator] = enabled;
        emit OperatorSet(operator, enabled);
    }

    function _isAuthorized(uint256 teamId) internal view {
        if (msg.sender == owner() || operators[msg.sender]) return;
        require(registry.isManager(teamId, msg.sender), "Only Manager, Operator, or Owner can write");
    }

    struct ProjectData {
        uint256 id;
        uint256 teamId;
        string name;
        string description;
        string image;
        uint256 quarter;
        uint256 year;
        uint256 MDP;
        string proposalIPFS;
        string proposalLink;
        string upfrontPayments;
        uint256 active;
        uint256 eligible;
    }

    function insertIntoTable(ProjectData calldata data) external onlyOperators {
        string memory part1 = string.concat(
            Strings.toString(data.id),
            ",",
            Strings.toString(data.teamId),
            ",",
            SQLHelpers.quote(data.name),
            ",",
            SQLHelpers.quote(data.description),
            ",",
            SQLHelpers.quote(data.image),
            ",",
            Strings.toString(data.quarter),
            ",",
            Strings.toString(data.year),
            ",",
            Strings.toString(data.MDP)
        );
        string memory part2 = string.concat(
            SQLHelpers.quote(data.proposalIPFS),
            ",",
            SQLHelpers.quote(data.proposalLink),
            ",",
            SQLHelpers.quote(""),
            ",",
            SQLHelpers.quote(""),
            ",",
            SQLHelpers.quote(""),
            ",",
            SQLHelpers.quote(data.upfrontPayments),
            ",",
            Strings.toString(data.active),
            ",",
            Strings.toString(data.eligible)
        );
        TablelandDeployments.get().mutate(
            address(this),
            _tableId,
            SQLHelpers.toInsert(
                _TABLE_PREFIX,
                _tableId,
                "id,teamId,name,description,image,quarter,year,MDP,proposalIPFS,proposalLink,finalReportIPFS,finalReportLink,rewardDistribution,upfrontPayments,active,eligible",
                string.concat(part1, ",", part2)
            )
        );
        idToTeamId[data.id] = data.teamId;
        emit ProjectInserted(data.id, data.teamId);
    }

    function updateTableCol(uint256 id, uint256 teamId, string memory colName, string memory val) external {
        require(Strings.equal(colName, "id") == false, "Cannot update id");
        require(Strings.equal(colName, "teamId") == false, "Cannot update teamId");
        require(idToTeamId[id] == teamId, "teamId mismatch");
        _isAuthorized(teamId);

        string memory setters = string.concat(colName, "=", SQLHelpers.quote(val));
        string memory filters = string.concat("id=", Strings.toString(id));
        TablelandDeployments.get().mutate(
            address(this),
            _tableId,
            SQLHelpers.toUpdate(_TABLE_PREFIX, _tableId, setters, filters)
        );
        emit ProjectUpdated(id, teamId);
    }

    function setActive(uint256 id, uint256 teamId, uint256 active) external {
        require(idToTeamId[id] == teamId, "teamId mismatch");
        // Only the owner/operator (governance) may toggle a project's active status.
        require(msg.sender == owner() || operators[msg.sender], "Only Owner or Operator");
        string memory setters = string.concat("active=", Strings.toString(active));
        string memory filters = string.concat("id=", Strings.toString(id));
        TablelandDeployments.get().mutate(
            address(this),
            _tableId,
            SQLHelpers.toUpdate(_TABLE_PREFIX, _tableId, setters, filters)
        );
        emit ProjectUpdated(id, teamId);
    }

    function setAccessControl(address controller) external onlyOwner {
        TablelandDeployments.get().setController(address(this), _tableId, controller);
    }

    function getTableId() external view returns (uint256) {
        return _tableId;
    }

    function getTableName() external view returns (string memory) {
        return SQLHelpers.toNameFromId(_TABLE_PREFIX, _tableId);
    }
}
