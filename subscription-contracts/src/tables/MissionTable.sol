pragma solidity ^0.8.20;

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {TablelandDeployments} from "@evm-tableland/contracts/utils/TablelandDeployments.sol";
import {SQLHelpers} from "@evm-tableland/contracts/utils/SQLHelpers.sol";
import {ERC721Holder} from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import {MoonDAOTeam} from "../ERC5643.sol";
import "@openzeppelin/contracts/utils/Strings.sol";


contract MissionTable is ERC721Holder, Ownable {
    using Strings for uint256;
    uint256 private _tableId;
    string private _TABLE_PREFIX;
    MoonDAOTeam public _moonDaoTeam;
    uint256 public currId = 0;
    mapping(uint256 => uint256) public idToTeamId;
    address public missionCreator;

    event MissionInserted(uint256 indexed id, uint256 indexed teamId, uint256 indexed projectId, uint256 fundingGoal);
    event MissionUpdated(uint256 indexed id, uint256 indexed teamId);
    event MissionDeleted(uint256 indexed id, uint256 indexed teamId);

    modifier onlyOperators() {
        require(msg.sender == owner() || msg.sender == missionCreator, "Only Owner or Creator can call this function");
        _;
    }

    constructor(string memory _table_prefix, address _missionCreator) Ownable(msg.sender) {
        _TABLE_PREFIX = _table_prefix;
        missionCreator = _missionCreator;
        _tableId = TablelandDeployments.get().create(
            address(this),
            SQLHelpers.toCreateFromSchema(
                "id integer primary key,"
                "projectId integer,"
                "teamId integer,"
                "fundingGoal text",
                _TABLE_PREFIX
            )
        );
    }

    function setMoonDaoTeam(address moonDaoTeam) external onlyOwner{
        _moonDaoTeam = MoonDAOTeam(moonDaoTeam);
    }

    function setMissionCreator(address _missionCreator) external onlyOwner{
        missionCreator = _missionCreator;
    }

    function addColumn(string memory columnName, string memory columnType) external onlyOwner {
        string memory alterStatement = string.concat(
            "ALTER TABLE ",
            SQLHelpers.toNameFromId(_TABLE_PREFIX, _tableId),
            " ADD COLUMN ",
            columnName,
            " ",
            columnType
        );

        TablelandDeployments.get().mutate(
            address(this),
            _tableId,
            alterStatement
        );
    }

    function deleteColumn(string memory columnName) external onlyOwner {
        string memory alterStatement = string.concat(
            "ALTER TABLE ",
            SQLHelpers.toNameFromId(_TABLE_PREFIX, _tableId),
            " DROP COLUMN ",
            columnName
        );

        TablelandDeployments.get().mutate(
            address(this),
            _tableId,
            alterStatement
        );
    }

    function insertIntoTable(uint256 teamId, uint256 projectId, uint256 fundingGoal) external onlyOperators returns (uint256) {
        string memory setters = string.concat(
                Strings.toString(currId),
                ",",
                Strings.toString(projectId),
                ",",
                Strings.toString(teamId),
                ",",
                // Convert to string to avoid overflow
                SQLHelpers.quote(fundingGoal.toString())
        );
        TablelandDeployments.get().mutate(
            address(this), // Table owner, i.e., this contract
            _tableId,
            SQLHelpers.toInsert(
                _TABLE_PREFIX,
                _tableId,
                "id,projectId,teamId,fundingGoal",
                setters
            )
        );
        idToTeamId[currId] = teamId;
        emit MissionInserted(currId, teamId, projectId, fundingGoal);
        currId += 1;
        return currId - 1;
    }

    function updateTableDynamic(uint256 id, string[] memory columns, string[] memory values) external {
        if (msg.sender != owner()) {
            require(_moonDaoTeam.isManager(idToTeamId[id], msg.sender), "Only Manager or Owner can update");
        }

        require(columns.length == values.length, "Columns and values length mismatch");

        //Create key-value pairs for setters
        string memory setters = string.concat(columns[0], "=", SQLHelpers.quote(values[0]));

        for (uint256 i = 1; i < columns.length; i++) {
            setters = string.concat(setters, ",", columns[i], "=", SQLHelpers.quote(values[i]));
        }

        string memory filters = string.concat(
            "id=",
            Strings.toString(id),
            "teamId=",
            Strings.toString(idToTeamId[id])
        );

        TablelandDeployments.get().mutate(
            address(this),
            _tableId,
            SQLHelpers.toUpdate(_TABLE_PREFIX, _tableId, setters, filters)
        );
        emit MissionUpdated(id, idToTeamId[id]);
    }

    function updateTableCol(uint256 id, string memory colName, string memory val) external {
        require (Strings.equal(colName, "id") == false, "Cannot update id");
        require (Strings.equal(colName, "teamId") == false, "Cannot update teamId");
        if (msg.sender != owner()) {
            require(_moonDaoTeam.isManager(idToTeamId[id], msg.sender), "Only Manager or Owner can update");
        }

        // Set the values to update
        string memory setters = string.concat(colName, "=", SQLHelpers.quote(val));
        // Specify filters for which row to update
        string memory filters = string.concat(
            "id=",
            Strings.toString(id)
        );
        // Mutate a row at `id` with a new `val`
        TablelandDeployments.get().mutate(
            address(this),
            _tableId,
            SQLHelpers.toUpdate(_TABLE_PREFIX, _tableId, setters, filters)
        );
        emit MissionUpdated(id, idToTeamId[id]);
    }

    function deleteFromTable(uint256 id) external {
        if (msg.sender != owner()) {
            require(_moonDaoTeam.isManager(idToTeamId[id], msg.sender), "Only Manager or Owner can delete");
        }

        // Specify filters for which row to delete
        string memory filters = string.concat(
            "id=",
            Strings.toString(id)
        );
        // Mutate a row at `id`
        TablelandDeployments.get().mutate(
            address(this),
            _tableId,
            SQLHelpers.toDelete(_TABLE_PREFIX, _tableId, filters)
        );
        emit MissionDeleted(id, idToTeamId[id]);
    }

    // Set the ACL controller to enable row-level writes with dynamic policies
    function setAccessControl(address controller) external onlyOwner{
        TablelandDeployments.get().setController(
            address(this), // Table owner, i.e., this contract
            _tableId,
            controller // Set the controller address—a separate controller contract
        );
    }

    // Return the table ID
    function getTableId() external view returns (uint256) {
        return _tableId;
    }

    // Return the table name
    function getTableName() external view returns (string memory) {
        return SQLHelpers.toNameFromId(_TABLE_PREFIX, _tableId);
    }
}
