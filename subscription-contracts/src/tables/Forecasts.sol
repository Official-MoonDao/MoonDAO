// SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@evm-tableland/contracts/utils/TablelandDeployments.sol";
import {SQLHelpers} from "@evm-tableland/contracts/utils/SQLHelpers.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import {ERC721Holder} from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";

/**
 * Public forecast book. Identity is an explicit `forecaster` handle supplied
 * by the owner/writer (the HSM relayer) — never msg.sender — so a gasless
 * Privy user can be published without a wallet.
 */
contract Forecasts is ERC721Holder, Ownable {
    uint256 private _tableId;
    string private _TABLE_PREFIX;
    mapping(address => bool) public writers;

    string private constant FORECAST_SCHEMA =
        "id integer primary key, chainSlug text, deprizeId integer, forecaster text, vector text, displayName text, updatedAt integer, unique(chainSlug, deprizeId, forecaster)";

    error NotWriter();

    constructor(string memory tablePrefix) Ownable(msg.sender) {
        _TABLE_PREFIX = tablePrefix;
        writers[msg.sender] = true;
        _tableId = TablelandDeployments.get().create(
            address(this),
            SQLHelpers.toCreateFromSchema(FORECAST_SCHEMA, _TABLE_PREFIX)
        );
    }

    modifier onlyWriter() {
        if (msg.sender != owner() && !writers[msg.sender]) revert NotWriter();
        _;
    }

    function setWriter(address account, bool allowed) external onlyOwner {
        writers[account] = allowed;
    }

    function insertRow(
        string memory chainSlug,
        uint256 deprizeId,
        string memory forecaster,
        string memory vector,
        string memory displayName,
        uint256 updatedAt
    ) external onlyWriter {
        TablelandDeployments.get().mutate(
            address(this),
            _tableId,
            SQLHelpers.toInsert(
                _TABLE_PREFIX,
                _tableId,
                "chainSlug,deprizeId,forecaster,vector,displayName,updatedAt",
                string.concat(
                    SQLHelpers.quote(chainSlug),
                    ",",
                    Strings.toString(deprizeId),
                    ",",
                    SQLHelpers.quote(forecaster),
                    ",",
                    "json(",
                    SQLHelpers.quote(vector),
                    ")",
                    ",",
                    SQLHelpers.quote(displayName),
                    ",",
                    Strings.toString(updatedAt)
                )
            )
        );
    }

    function updateRow(
        string memory chainSlug,
        uint256 deprizeId,
        string memory forecaster,
        string memory vector,
        string memory displayName,
        uint256 updatedAt
    ) external onlyWriter {
        TablelandDeployments.get().mutate(
            address(this),
            _tableId,
            SQLHelpers.toUpdate(
                _TABLE_PREFIX,
                _tableId,
                string.concat(
                    "vector=",
                    "json(",
                    SQLHelpers.quote(vector),
                    ")",
                    ",displayName=",
                    SQLHelpers.quote(displayName),
                    ",updatedAt=",
                    Strings.toString(updatedAt)
                ),
                _where(chainSlug, deprizeId, forecaster)
            )
        );
    }

    function deleteRow(
        string memory chainSlug,
        uint256 deprizeId,
        string memory forecaster
    ) external onlyWriter {
        TablelandDeployments.get().mutate(
            address(this),
            _tableId,
            SQLHelpers.toDelete(_TABLE_PREFIX, _tableId, _where(chainSlug, deprizeId, forecaster))
        );
    }

    function getTableId() external view returns (uint256) {
        return _tableId;
    }

    function getTableName() external view returns (string memory) {
        return SQLHelpers.toNameFromId(_TABLE_PREFIX, _tableId);
    }

    function _where(
        string memory chainSlug,
        uint256 deprizeId,
        string memory forecaster
    ) private pure returns (string memory) {
        return
            string.concat(
                "chainSlug = ",
                SQLHelpers.quote(chainSlug),
                " AND deprizeId = ",
                Strings.toString(deprizeId),
                " AND forecaster = ",
                SQLHelpers.quote(forecaster)
            );
    }
}
