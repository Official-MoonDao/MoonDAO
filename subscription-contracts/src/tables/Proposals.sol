pragma solidity >=0.8.11 <0.9.0;

import "@evm-tableland/contracts/interfaces/ITablelandTables.sol";
import "@evm-tableland/contracts/interfaces/ITablelandController.sol";
import "@evm-tableland/contracts/utils/TablelandDeployments.sol";
import {SQLHelpers} from "@evm-tableland/contracts/utils/SQLHelpers.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import {Senators} from "../Senators.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import {ERC721Holder} from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";

contract Proposals is ERC721Holder, Ownable {
    // Table for storing votes.
    // vote is a json object with keys being outcome id
    // values percentage allocated to that outcome.
    // mdp is a foreign key for representing which
    // motion the vote is for.
    using ERC165Checker for address;

    Senators senators;
    mapping(uint256 => mapping(address => bool)) public tempCheckVoteApprove;
    mapping(uint256 => mapping(address => bool)) public tempCheckVoteDeny;
    mapping(uint256 => uint256) public tempCheckApprovalCount;
    mapping(uint256 => uint256) public tempCheckVoteCount;
    mapping(uint256 => bool) public tempCheckApproved;
    mapping(uint256 => uint256) public tempCheckApprovedTimestamp;
    mapping(uint256 => bool) public tempCheckFailed;

    uint256 private _tableId;
    string private _TABLE_PREFIX;
    string private constant VOTE_SCHEMA =
        "id integer primary key, quarter integer, year integer, address text, distribution text, unique(quarter, year, address)";

    constructor(string memory _table_prefix, address _senatorsAddress) Ownable(msg.sender)  {
        _TABLE_PREFIX = _table_prefix;
        _tableId = TablelandDeployments.get().create(
            address(this),
            SQLHelpers.toCreateFromSchema(VOTE_SCHEMA, _TABLE_PREFIX)
        );
        senators = Senators(_senatorsAddress);
    }

    function setSenators(address _senatorsAddress) external onlyOwner {
        senators = Senators(_senatorsAddress);
    }

    function getQuorum() public view returns (uint256) {
        return  ((senators.senatorCount() * 7) + 9) / 10;
    }

    function voteTempCheck(uint256 mdp, bool approve) external {
        require(senators.isSenator(msg.sender), "Must be a senator to vote on temp check");
        require(!tempCheckApproved[mdp], "Temp check already passed");
        require(!tempCheckFailed[mdp], "Temp check already failed");
        bool alreadyVoted = tempCheckVoteApprove[mdp][msg.sender] || tempCheckVoteDeny[mdp][msg.sender];
        if (!alreadyVoted){
            tempCheckVoteCount[mdp]++;
        }
        if (approve){
            require(!tempCheckVoteApprove[mdp][msg.sender], "Already voted");
            tempCheckVoteApprove[mdp][msg.sender] = true;
            tempCheckVoteDeny[mdp][msg.sender] = false;
            tempCheckApprovalCount[mdp]++;
        } else {
            require(!tempCheckVoteDeny[mdp][msg.sender], "Already voted");
            tempCheckVoteDeny[mdp][msg.sender] = true;
            tempCheckVoteApprove[mdp][msg.sender] = false;
            if (alreadyVoted){ // Switching from approve to deny
                tempCheckApprovalCount[mdp]--;
            }
        }
    }

    function tallyVotes(uint256 mdp) public onlyOwner {
        if (tempCheckVoteCount[mdp] >= getQuorum()){
            // Check if at least 2/3 of the senators voted in favor of the proposal
            if (tempCheckApprovalCount[mdp] * 3 >= tempCheckVoteCount[mdp] * 2){
                tempCheckApproved[mdp] = true;
                tempCheckApprovedTimestamp[mdp] = block.timestamp;
                tempCheckFailed[mdp] = false;
            } else {
                tempCheckFailed[mdp] = true;
                tempCheckApproved[mdp] = false;
                tempCheckApprovedTimestamp[mdp] = 0;
            }
        }
    }

    function insertIntoTable(uint256 quarter, uint256 year, string memory distribution) external {
        TablelandDeployments.get().mutate(
            address(this), // Table owner, i.e., this contract
            _tableId,
            SQLHelpers.toInsert(
                _TABLE_PREFIX,
                _tableId,
                "quarter,year,address,distribution",
                string.concat(
                    Strings.toString(quarter),
                    ",",
                    Strings.toString(year),
                    ",",
                    SQLHelpers.quote(Strings.toHexString(msg.sender)),
                    ",",
                    "json(",
                    SQLHelpers.quote(distribution),
                    ")"
                )
            )
        );
    }

    function updateTableCol(uint256 quarter, uint256 year, string memory distribution) external {
        TablelandDeployments.get().mutate(
            address(this), // Table owner, i.e., this contract
            _tableId,
            SQLHelpers.toUpdate(
                _TABLE_PREFIX,
                _tableId,
                string.concat(
                "distribution=",
                    "json(",
                    SQLHelpers.quote(distribution),
                    ")"
                ),
                string.concat(
                    "quarter = ",
                    Strings.toString(quarter),
                    " AND year = ",
                    Strings.toString(year),
                    " AND address = ",
                    SQLHelpers.quote(Strings.toHexString(msg.sender))
                )
            )
        );
    }

    function deleteFromTable(uint256 quarter, uint256 year) external {
        TablelandDeployments.get().mutate(
            address(this),
            _tableId,
            SQLHelpers.toDelete(_TABLE_PREFIX, _tableId,
                string.concat(
                    "quarter = ",
                    Strings.toString(quarter),
                    " AND year = ",
                    Strings.toString(year),
                    " AND address = ",
                    SQLHelpers.quote(Strings.toHexString(msg.sender))
                )
)
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

    function getTableId() external view returns (uint256) {
        return _tableId;
    }

    function getTableName() external view returns (string memory) {
        return SQLHelpers.toNameFromId(_TABLE_PREFIX, _tableId);
    }

}
