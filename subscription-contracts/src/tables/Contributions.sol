// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC721Holder} from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import {ITablelandTables} from "@evm-tableland/contracts/interfaces/ITablelandTables.sol";
import {TablelandDeployments} from "@evm-tableland/contracts/utils/TablelandDeployments.sol";
import {SQLHelpers} from "@evm-tableland/contracts/utils/SQLHelpers.sol";
import {SqlString} from "./SqlString.sol";

/// @notice Citizen NFT reads used to gate writes. Matches `MoonDAOCitizen`.
interface ICitizenNFT {
    function balanceOf(address owner) external view returns (uint256);
    function getOwnedToken(address owner) external view returns (uint256);
    function expiresAt(uint256 tokenId) external view returns (uint64);
}

/// @title Contributions
/// @notice One Tableland table of citizen contributions, grouped by cycle.
///
/// A cycle is just an increasing number. Deploy scripts use quarter codes
/// (`20264` = Q4 2026) so past quarters can be imported below the open one.
/// Submissions always land in `currentCycleId`. The contract does not know
/// dates or how a cycle is scored.
///
/// Closing a cycle and writing its payout are owner calls. The owner is the
/// Safe that also sends the payments: a cron job proposes the transaction, and
/// signers execute `closeCycle` and `recordResults` in that same batch. Nothing
/// here is final until they sign. Operators can only hide a row.
///
/// A submitted row's author is `msg.sender` (`origin = 0`). The owner can also
/// import rows on someone else's behalf with an explicit author, cycle and
/// timestamp (`origin = 1`) to backfill history, until `sealImports` is called.
/// Content can be edited or removed only by the row's author, and only while
/// the row's cycle is still the open one.
contract Contributions is ERC721Holder, Ownable {
    struct Entry {
        address author;
        uint256 cycleId;
        bool hasResult;
    }

    /// @notice One historical row for `importBatch`. `reward` is JSON text or
    /// empty. A row with a nonzero `shareBps` or a reward counts as already
    /// recorded, so `recordResults` cannot overwrite it.
    struct ImportRow {
        address author;
        uint256 cycleId;
        uint64 createdAt;
        string title;
        string description;
        string area;
        string links;
        string metadata;
        uint256 shareBps;
        string reward;
    }

    uint8 public constant ORIGIN_SUBMITTED = 0;
    uint8 public constant ORIGIN_IMPORTED = 1;

    uint256 public constant TITLE_MAX = 120;
    uint256 public constant DESCRIPTION_MAX = 2000;
    uint256 public constant AREA_MAX = 32;
    uint256 public constant LINKS_MAX = 1000;
    uint256 public constant METADATA_MAX = 1000;
    uint256 public constant REWARD_MAX = 1000;
    // Tableland rejects statements of 35,001 bytes or more.
    uint256 public constant STATEMENT_MAX = 35_000;
    uint256 public constant SHARE_BPS_MAX = 10_000;

    string private constant _COLUMNS =
        "id,cycleId,author,title,description,area,links,metadata,origin,hidden,createdAt,updatedAt,shareBps,reward";

    uint256 private _tableId;
    string private _tablePrefix;

    uint256 public currentCycleId;
    uint256 public nextId = 1;
    /// @notice Once true, `importBatch` is disabled forever.
    bool public importsSealed;
    /// @notice Submissions per author per cycle. Zero disables the cap.
    uint256 public maxPerCycle;
    ICitizenNFT public citizenNFT;

    mapping(address => bool) public operators;
    mapping(uint256 => Entry) public entries;
    mapping(uint256 => mapping(address => uint256)) public countInCycle;

    event ContributionSubmitted(uint256 indexed id, uint256 indexed cycleId, address indexed author);
    event ContributionUpdated(uint256 indexed id);
    event ContributionRemoved(uint256 indexed id, uint256 indexed cycleId);
    event HiddenSet(uint256 indexed id, bool hidden);
    event CycleClosed(uint256 indexed cycleId, uint256 nextCycleId);
    event ResultRecorded(uint256 indexed cycleId, uint256 indexed id, uint256 shareBps);
    event OperatorSet(address indexed operator, bool enabled);
    event ContributionImported(uint256 indexed id, uint256 indexed cycleId, address indexed author);
    event ImportsSealed();

    error NotCitizen();
    error TextTooLong();
    error EmptyField();
    error CapReached();
    error NotAuthor();
    error CycleClosedForEdits();
    error WrongCycle();
    error NotFound();
    error NotOperator();
    error ResultsExist();
    error CycleStillOpen();
    error LengthMismatch();
    error ShareTooLarge();
    error EmptyBatch();
    error ZeroAddress();
    error StatementTooLong();
    error ImportsClosed();
    error FutureCycle();
    error BadTimestamp();
    error CycleNotIncreasing();

    constructor(string memory tablePrefix, address citizenNFT_, uint256 maxPerCycle_, uint256 initialCycleId)
        Ownable(msg.sender)
    {
        if (citizenNFT_ == address(0)) revert ZeroAddress();
        if (initialCycleId == 0) revert CycleNotIncreasing();
        _tablePrefix = tablePrefix;
        citizenNFT = ICitizenNFT(citizenNFT_);
        maxPerCycle = maxPerCycle_;
        currentCycleId = initialCycleId;
        _tableId = TablelandDeployments.get()
            .create(
                address(this),
                SQLHelpers.toCreateFromSchema(
                    "id integer primary key," "cycleId integer not null," "author text not null," "title text not null,"
                    "description text not null," "area text not null," "links text not null," "metadata text not null,"
                    "origin integer not null," "hidden integer not null," "createdAt integer not null,"
                    "updatedAt integer not null," "shareBps integer not null," "reward text not null",
                    tablePrefix
                )
            );
        // No controller, ever. With none set, only this contract can write,
        // and locking it means nobody can add a second write path later.
        TablelandDeployments.get().lockController(address(this), _tableId);
    }

    function submit(
        string calldata title,
        string calldata description,
        string calldata area,
        string calldata links,
        string calldata metadata
    ) external returns (uint256 id) {
        _requireCitizen(msg.sender);
        uint256 cycleId = currentCycleId;
        if (maxPerCycle != 0 && countInCycle[cycleId][msg.sender] >= maxPerCycle) revert CapReached();

        id = nextId++;
        countInCycle[cycleId][msg.sender] += 1;
        entries[id] = Entry({author: msg.sender, cycleId: cycleId, hasResult: false});

        _mutate(
            SQLHelpers.toInsert(
                _tablePrefix,
                _tableId,
                _COLUMNS,
                _insertValues(id, cycleId, msg.sender, title, description, area, links, metadata)
            )
        );
        emit ContributionSubmitted(id, cycleId, msg.sender);
    }

    function update(
        uint256 id,
        string calldata title,
        string calldata description,
        string calldata area,
        string calldata links,
        string calldata metadata
    ) external {
        _requireAuthorOpen(id);
        _mutate(
            SQLHelpers.toUpdate(
                _tablePrefix, _tableId, _updateSetters(title, description, area, links, metadata), _idFilter(id)
            )
        );
        emit ContributionUpdated(id);
    }

    /// @notice Remove the caller's own contribution and free its cap slot.
    /// Only while the contribution's cycle is still open.
    function remove(uint256 id) external {
        Entry memory entry = _requireAuthorOpen(id);
        countInCycle[entry.cycleId][entry.author] -= 1;
        delete entries[id];
        _mutate(SQLHelpers.toDelete(_tablePrefix, _tableId, _idFilter(id)));
        emit ContributionRemoved(id, entry.cycleId);
    }

    /// @notice Hide or unhide a row. The row stays in the table either way.
    function setHidden(uint256 id, bool hidden) external {
        if (msg.sender != owner() && !operators[msg.sender]) revert NotOperator();
        if (entries[id].author == address(0)) revert NotFound();
        _mutate(
            SQLHelpers.toUpdate(_tablePrefix, _tableId, string.concat("hidden=", hidden ? "1" : "0"), _idFilter(id))
        );
        emit HiddenSet(id, hidden);
    }

    /// @notice End the open cycle and open `nextCycleId`, which must be larger.
    /// Called by the payout Safe, in the same signed batch as the payments.
    function closeCycle(uint256 nextCycleId) external onlyOwner {
        uint256 closed = currentCycleId;
        if (nextCycleId <= closed) revert CycleNotIncreasing();
        currentCycleId = nextCycleId;
        emit CycleClosed(closed, nextCycleId);
    }

    /// @notice Backfill contributions made by other people, with an explicit
    /// author, cycle and creation time. Authors need not be current citizens.
    /// Rows go in as one multi-row insert, so callers must keep each batch
    /// under `STATEMENT_MAX` bytes. Rows imported into the open cycle behave
    /// like submissions: their author can edit or remove them until it closes.
    function importBatch(ImportRow[] calldata rows) external onlyOwner returns (uint256 firstId) {
        if (importsSealed) revert ImportsClosed();
        uint256 n = rows.length;
        if (n == 0) revert EmptyBatch();
        uint256 openCycle = currentCycleId;
        firstId = nextId;

        string[] memory values = new string[](n);
        for (uint256 i; i < n; ++i) {
            ImportRow calldata row = rows[i];
            if (row.author == address(0)) revert ZeroAddress();
            if (row.cycleId == 0) revert WrongCycle();
            if (row.cycleId > openCycle) revert FutureCycle();
            if (row.createdAt == 0 || row.createdAt > block.timestamp) revert BadTimestamp();
            if (row.shareBps > SHARE_BPS_MAX) revert ShareTooLarge();
            bool hasResult = row.shareBps != 0 || bytes(row.reward).length != 0;
            if (hasResult && row.cycleId == openCycle) revert CycleStillOpen();

            uint256 id = firstId + i;
            countInCycle[row.cycleId][row.author] += 1;
            entries[id] = Entry({author: row.author, cycleId: row.cycleId, hasResult: hasResult});
            values[i] = _importValues(id, row);
            emit ContributionImported(id, row.cycleId, row.author);
        }
        nextId = firstId + n;
        _mutate(SQLHelpers.toBatchInsert(_tablePrefix, _tableId, _COLUMNS, values));
    }

    /// @notice Permanently disable `importBatch` once the backfill is reviewed.
    function sealImports() external onlyOwner {
        if (importsSealed) revert ImportsClosed();
        importsSealed = true;
        emit ImportsSealed();
    }

    /// @notice Write each contribution's share of the pool and what it was paid.
    /// Once per contribution, and only for a cycle that has already been closed.
    /// `shareBps` is out of 10,000. `rewards` entries are JSON text, or `{}` when unpaid.
    function recordResults(
        uint256 cycleId,
        uint256[] calldata ids,
        uint256[] calldata shareBps,
        string[] calldata rewards
    ) external onlyOwner {
        if (cycleId >= currentCycleId) revert CycleStillOpen();
        uint256 n = ids.length;
        if (n == 0) revert EmptyBatch();
        if (shareBps.length != n || rewards.length != n) revert LengthMismatch();

        ITablelandTables.Statement[] memory statements = new ITablelandTables.Statement[](n);
        for (uint256 i; i < n; ++i) {
            Entry memory entry = entries[ids[i]];
            if (entry.author == address(0)) revert NotFound();
            if (entry.cycleId != cycleId) revert WrongCycle();
            if (entry.hasResult) revert ResultsExist();
            if (shareBps[i] > SHARE_BPS_MAX) revert ShareTooLarge();
            entries[ids[i]].hasResult = true;

            statements[i] = ITablelandTables.Statement({
                tableId: _tableId, statement: _resultStatement(ids[i], shareBps[i], rewards[i])
            });
            emit ResultRecorded(cycleId, ids[i], shareBps[i]);
        }
        for (uint256 i; i < n; ++i) {
            if (bytes(statements[i].statement).length >= STATEMENT_MAX) revert StatementTooLong();
        }
        TablelandDeployments.get().mutate(address(this), statements);
    }

    function setOperator(address operator, bool enabled) external onlyOwner {
        if (operator == address(0)) revert ZeroAddress();
        operators[operator] = enabled;
        emit OperatorSet(operator, enabled);
    }

    function setCitizenNFT(address citizenNFT_) external onlyOwner {
        if (citizenNFT_ == address(0)) revert ZeroAddress();
        citizenNFT = ICitizenNFT(citizenNFT_);
    }

    function setMaxPerCycle(uint256 max) external onlyOwner {
        maxPerCycle = max;
    }

    function getTableId() external view returns (uint256) {
        return _tableId;
    }

    function getTableName() external view returns (string memory) {
        return SQLHelpers.toNameFromId(_tablePrefix, _tableId);
    }

    function _requireCitizen(address who) internal view {
        if (citizenNFT.balanceOf(who) == 0) revert NotCitizen();
        uint256 tokenId = citizenNFT.getOwnedToken(who);
        if (uint256(citizenNFT.expiresAt(tokenId)) <= block.timestamp) revert NotCitizen();
    }

    function _requireAuthorOpen(uint256 id) internal view returns (Entry memory entry) {
        entry = entries[id];
        if (entry.author == address(0)) revert NotFound();
        if (entry.author != msg.sender) revert NotAuthor();
        if (entry.cycleId != currentCycleId) revert CycleClosedForEdits();
        _requireCitizen(msg.sender);
    }

    /// @dev Built in short pieces. One `string.concat` of every column blows the
    /// Yul stack under `forge coverage --ir-minimum` (one slot too deep).
    function _insertValues(
        uint256 id,
        uint256 cycleId,
        address author,
        string calldata title,
        string calldata description,
        string calldata area,
        string calldata links,
        string calldata metadata
    ) internal view returns (string memory values) {
        values = string.concat(Strings.toString(id), ",", Strings.toString(cycleId));
        values = string.concat(values, ",", SqlString.quote(Strings.toHexString(author)));
        values = string.concat(values, ",", _text(title, TITLE_MAX, true));
        values = string.concat(values, ",", _text(description, DESCRIPTION_MAX, true));
        values = string.concat(values, ",", _text(area, AREA_MAX, true));
        values = string.concat(values, ",", _text(links, LINKS_MAX, false));
        values = string.concat(values, ",", _text(metadata, METADATA_MAX, false));
        string memory ts = Strings.toString(block.timestamp);
        values = string.concat(values, ",0,0,", ts, ",", ts, ",0,", SqlString.quote(""));
    }

    function _importValues(uint256 id, ImportRow calldata row) internal view returns (string memory values) {
        values = string.concat(Strings.toString(id), ",", Strings.toString(row.cycleId));
        values = string.concat(values, ",", SqlString.quote(Strings.toHexString(row.author)));
        values = string.concat(values, ",", _text(row.title, TITLE_MAX, true));
        values = string.concat(values, ",", _text(row.description, DESCRIPTION_MAX, true));
        values = string.concat(values, ",", _text(row.area, AREA_MAX, true));
        values = string.concat(values, ",", _text(row.links, LINKS_MAX, false));
        values = string.concat(values, ",", _text(row.metadata, METADATA_MAX, false));
        values = string.concat(values, ",1,0,", Strings.toString(row.createdAt));
        values = string.concat(values, ",", Strings.toString(block.timestamp));
        values = string.concat(values, ",", Strings.toString(row.shareBps));
        values = string.concat(values, ",", _text(row.reward, REWARD_MAX, false));
    }

    function _updateSetters(
        string calldata title,
        string calldata description,
        string calldata area,
        string calldata links,
        string calldata metadata
    ) internal view returns (string memory setters) {
        setters = string.concat("title=", _text(title, TITLE_MAX, true));
        setters = string.concat(setters, ",description=", _text(description, DESCRIPTION_MAX, true));
        setters = string.concat(setters, ",area=", _text(area, AREA_MAX, true));
        setters = string.concat(setters, ",links=", _text(links, LINKS_MAX, false));
        setters = string.concat(setters, ",metadata=", _text(metadata, METADATA_MAX, false));
        setters = string.concat(setters, ",updatedAt=", Strings.toString(block.timestamp));
    }

    function _resultStatement(uint256 id, uint256 shareBps, string calldata reward)
        internal
        view
        returns (string memory)
    {
        string memory setters = string.concat("shareBps=", Strings.toString(shareBps));
        setters = string.concat(setters, ",reward=", _text(reward, REWARD_MAX, false));
        setters = string.concat(setters, ",updatedAt=", Strings.toString(block.timestamp));
        return SQLHelpers.toUpdate(_tablePrefix, _tableId, setters, _idFilter(id));
    }

    function _text(string calldata s, uint256 maxLen, bool required) internal pure returns (string memory) {
        uint256 n = bytes(s).length;
        if (required && n == 0) revert EmptyField();
        if (n > maxLen) revert TextTooLong();
        return SqlString.quote(s);
    }

    function _idFilter(uint256 id) internal pure returns (string memory) {
        return string.concat("id=", Strings.toString(id));
    }

    function _mutate(string memory statement) internal {
        if (bytes(statement).length >= STATEMENT_MAX) revert StatementTooLong();
        TablelandDeployments.get().mutate(address(this), _tableId, statement);
    }
}
