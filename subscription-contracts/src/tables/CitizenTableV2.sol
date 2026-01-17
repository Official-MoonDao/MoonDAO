pragma solidity ^0.8.20;

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {TablelandDeployments} from "@evm-tableland/contracts/utils/TablelandDeployments.sol";
import {SQLHelpers} from "@evm-tableland/contracts/utils/SQLHelpers.sol";
import {ERC721Holder} from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import {NFTURITemplateGenerator} from "./NFTURITemplateGenerator.sol";

contract MoonDAOCitizenTable is ERC721Holder, Ownable {
    uint256 private _tableId;
    string private _TABLE_PREFIX;
    uint256 public version = 2;
    address public _citizenAddress;

    constructor(string memory _table_prefix) Ownable(msg.sender) {
        _TABLE_PREFIX = _table_prefix;
        _tableId = TablelandDeployments.get().create(
            address(this),
            SQLHelpers.toCreateFromSchema(
                "id integer primary key,"
                "name text,"
                "description text,"
                "image text,"
                "location text,"
                "discord text,"
                "twitter text,"
                "website text,"
                "view text,"
                "formId text,"
                "owner text",
                _TABLE_PREFIX
            )
        );
    }

    modifier onlyOperators() {
        require(msg.sender == _citizenAddress || msg.sender == owner(), "Only Citizen contract or Owner can call this function");
        _;
    }

    function setCitizenAddress(address citizenAddress) external onlyOwner {
        _citizenAddress = citizenAddress;
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

    // Let anyone insert into the table
    function insertIntoTable(uint256 id, string memory name, string memory description, string memory image, string memory location, string memory discord, string memory twitter, string memory instagram, string memory linkedin, string memory website, string memory _view, string memory formId, address owner) external onlyOperators {
        string memory setters = string.concat(
            string.concat(
                Strings.toString(id),
                ",",
                SQLHelpers.quote(name),
                ",",
                SQLHelpers.quote(description),
                ",",
                SQLHelpers.quote(image),
                ",",
                SQLHelpers.quote(location)
            ),
            ",",
            SQLHelpers.quote(discord),
            ",",
            SQLHelpers.quote(twitter),
            ",",
            SQLHelpers.quote(instagram),
            ",",
            SQLHelpers.quote(linkedin),
            ",",
            SQLHelpers.quote(website),
            ",",
            SQLHelpers.quote(_view),
            ",",
            SQLHelpers.quote(formId),
            ",",
            SQLHelpers.quote(Strings.toHexString(owner))
        );

        TablelandDeployments.get().mutate(
            address(this), // Table owner, i.e., this contract
            _tableId,
            SQLHelpers.toInsert(
                _TABLE_PREFIX,
                _tableId,
                "id,name,description,image,location,discord,twitter,instagram,linkedin,website,view,formId,owner",
                setters
            )
        );
    }

    function updateTableDynamic(uint256 id, string[] memory columns, string[] memory values) external {
        require(columns.length == values.length, "Columns and values length mismatch");

        // Manually create key-value pairs for setters
        string memory setters = string.concat(columns[0], "=", SQLHelpers.quote(values[0]));

        for (uint256 i = 1; i < columns.length; i++) {
            setters = string.concat(setters, ",", columns[i], "=", SQLHelpers.quote(values[i]));
        }

        string memory filters = string.concat(
            "id=",
            Strings.toString(id)
        );

        TablelandDeployments.get().mutate(
            address(this),
            _tableId,
            SQLHelpers.toUpdate(_TABLE_PREFIX, _tableId, setters, filters)
        );
    }


    // Delete a row from the table by ID 
    function deleteFromTable(uint256 id) external {
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
        return _getTableName();
    }

    function _getTableName() internal view returns (string memory) {
        return SQLHelpers.toNameFromId(_TABLE_PREFIX, _tableId);
    }

    // Generate a URI template for the nft contract
    function generateURITemplate(string[] memory attributes) external view returns (string memory) {
        return NFTURITemplateGenerator.generateURITemplate(_getTableName(), attributes);
    }
}