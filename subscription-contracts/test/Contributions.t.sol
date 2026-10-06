// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {ITablelandTables} from "@evm-tableland/contracts/interfaces/ITablelandTables.sol";
import {TablelandDeployments} from "@evm-tableland/contracts/utils/TablelandDeployments.sol";
import {Contributions, ICitizenNFT} from "../src/tables/Contributions.sol";
import {SqlString} from "../src/tables/SqlString.sol";

contract MockCitizenNFT is ICitizenNFT {
    mapping(address => uint256) public balances;
    mapping(address => uint256) public tokenOf;
    mapping(uint256 => uint64) public expiry;

    function set(address who, uint256 tokenId, uint64 expiresAt_) external {
        balances[who] = 1;
        tokenOf[who] = tokenId;
        expiry[tokenId] = expiresAt_;
    }

    function clear(address who) external {
        balances[who] = 0;
    }

    function balanceOf(address owner) external view returns (uint256) {
        return balances[owner];
    }

    function getOwnedToken(address owner) external view returns (uint256) {
        require(balances[owner] > 0, "No token owned");
        return tokenOf[owner];
    }

    function expiresAt(uint256 tokenId) external view returns (uint64) {
        return expiry[tokenId];
    }
}

contract SqlStringHarness {
    function quote(string memory s) external pure returns (string memory) {
        return SqlString.quote(s);
    }
}

contract ContributionsTest is Test {
    uint256 internal constant TABLE_ID = 7;
    uint256 internal constant NOW = 1_000_000;

    Contributions internal table;
    MockCitizenNFT internal citizen;
    SqlStringHarness internal sql;
    address internal tableland;

    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);
    address internal operator = address(0x0B0);

    function setUp() public {
        vm.warp(NOW);
        tableland = address(TablelandDeployments.get());
        vm.etch(tableland, hex"00");
        vm.mockCall(tableland, abi.encodeWithSignature("create(address,string)"), abi.encode(TABLE_ID));
        vm.mockCall(tableland, abi.encodeWithSignature("mutate(address,uint256,string)"), abi.encode());
        vm.mockCall(tableland, abi.encodeWithSignature("mutate(address,(uint256,string)[])"), abi.encode());
        vm.mockCall(tableland, abi.encodeWithSignature("lockController(address,uint256)"), abi.encode());

        citizen = new MockCitizenNFT();
        sql = new SqlStringHarness();
        table = new Contributions("CONTRIBUTIONS", address(citizen), 5);
        _enroll(alice, uint64(NOW + 365 days));
        _enroll(bob, uint64(NOW + 365 days));
    }

    function test_constructorLocksTheController() public {
        vm.expectCall(tableland, abi.encodeWithSignature("lockController(address,uint256)"));
        new Contributions("CONTRIBUTIONS", address(citizen), 5);
    }

    function test_constructorRejectsZeroCitizen() public {
        vm.expectRevert(Contributions.ZeroAddress.selector);
        new Contributions("CONTRIBUTIONS", address(0), 5);
    }

    function test_tableName() public view {
        assertEq(table.getTableId(), TABLE_ID);
        assertEq(table.getTableName(), string.concat("CONTRIBUTIONS_", vm.toString(block.chainid), "_7"));
        assertEq(table.currentCycleId(), 1);
        assertEq(table.maxPerCycle(), 5);
    }

    function test_submitWritesEscapedRow() public {
        string memory title = "it'); DROP TABLE t;--";
        string memory expected = string.concat(
            "INSERT INTO ",
            table.getTableName(),
            "(id,cycleId,author,title,description,area,links,metadata,hidden,createdAt,updatedAt,shareBps,reward)VALUES(",
            "1,1,",
            sql.quote(Strings.toHexString(alice)),
            ",",
            sql.quote(title),
            ",",
            sql.quote("did the thing"),
            ",",
            sql.quote("technical"),
            ",",
            sql.quote(""),
            ",",
            sql.quote(""),
            ",0,",
            vm.toString(NOW),
            ",",
            vm.toString(NOW),
            ",0,",
            sql.quote(""),
            ")"
        );
        vm.expectCall(
            tableland, abi.encodeWithSignature("mutate(address,uint256,string)", address(table), TABLE_ID, expected)
        );
        vm.prank(alice);
        uint256 id = table.submit(title, "did the thing", "technical", "", "");
        assertEq(id, 1);
        (address author, uint256 cycleId, bool hasResult) = table.entries(1);
        assertEq(author, alice);
        assertEq(cycleId, 1);
        assertFalse(hasResult);
        assertEq(table.countInCycle(1, alice), 1);
    }

    function test_submitRevertsForNonCitizenWithoutWriting() public {
        citizen.clear(bob);
        _expectNoMutate();
        vm.prank(bob);
        vm.expectRevert(Contributions.NotCitizen.selector);
        table.submit("t", "d", "area", "", "");
    }

    function test_submitRevertsWhenExpiredWithoutWriting() public {
        _enroll(bob, uint64(NOW));
        _expectNoMutate();
        vm.prank(bob);
        vm.expectRevert(Contributions.NotCitizen.selector);
        table.submit("t", "d", "area", "", "");
    }

    function test_submitRevertsOnEmptyTitleWithoutWriting() public {
        _expectNoMutate();
        vm.prank(alice);
        vm.expectRevert(Contributions.EmptyField.selector);
        table.submit("", "d", "area", "", "");
    }

    function test_submitRevertsOnLongTitleWithoutWriting() public {
        _expectNoMutate();
        vm.prank(alice);
        vm.expectRevert(Contributions.TextTooLong.selector);
        table.submit(_repeat("a", 121), "d", "area", "", "");
    }

    function test_submitRevertsOnNulWithoutWriting() public {
        _expectNoMutate();
        vm.prank(alice);
        vm.expectRevert(SqlString.InvalidText.selector);
        table.submit(string(abi.encodePacked("a", bytes1(0), "b")), "d", "area", "", "");
    }

    function test_capIsFivePerAuthorPerCycle() public {
        for (uint256 i; i < 5; ++i) {
            vm.prank(alice);
            table.submit("t", "d", "area", "", "");
        }
        assertEq(table.countInCycle(1, alice), 5);
        vm.prank(alice);
        vm.expectRevert(Contributions.CapReached.selector);
        table.submit("t", "d", "area", "", "");

        vm.prank(alice);
        table.remove(3);
        assertEq(table.countInCycle(1, alice), 4);
        (address author,,) = table.entries(3);
        assertEq(author, address(0));

        vm.prank(alice);
        uint256 id = table.submit("t", "d", "area", "", "");
        assertEq(id, 6);
        assertEq(table.countInCycle(1, alice), 5);
    }

    function test_authorCanUpdateUntilTheCycleCloses() public {
        _submit(alice);
        string memory expected = string.concat(
            "UPDATE ",
            table.getTableName(),
            " SET title=",
            sql.quote("new"),
            ",description=",
            sql.quote("d2"),
            ",area=",
            sql.quote("research"),
            ",links=",
            sql.quote("https://example.com"),
            ",metadata=",
            sql.quote("{}"),
            ",updatedAt=",
            vm.toString(NOW),
            " WHERE id=1"
        );
        vm.expectCall(
            tableland, abi.encodeWithSignature("mutate(address,uint256,string)", address(table), TABLE_ID, expected)
        );
        vm.prank(alice);
        table.update(1, "new", "d2", "research", "https://example.com", "{}");
    }

    function test_strangerCannotUpdate() public {
        _submit(alice);
        _expectNoMutate();
        vm.prank(bob);
        vm.expectRevert(Contributions.NotAuthor.selector);
        table.update(1, "new", "d2", "research", "", "");
    }

    function test_lapsedCitizenCannotUpdate() public {
        _submit(alice);
        _enroll(alice, uint64(NOW));
        _expectNoMutate();
        vm.prank(alice);
        vm.expectRevert(Contributions.NotCitizen.selector);
        table.update(1, "new", "d2", "research", "", "");
    }

    function test_removeByAuthorDeletesTheRow() public {
        _submit(alice);
        string memory expected = string.concat("DELETE FROM ", table.getTableName(), " WHERE id=1");
        vm.expectCall(
            tableland, abi.encodeWithSignature("mutate(address,uint256,string)", address(table), TABLE_ID, expected)
        );
        vm.prank(alice);
        table.remove(1);
        assertEq(table.countInCycle(1, alice), 0);
    }

    function test_strangerCannotRemove() public {
        _submit(alice);
        _expectNoMutate();
        vm.prank(bob);
        vm.expectRevert(Contributions.NotAuthor.selector);
        table.remove(1);
    }

    function test_closedCycleLocksEditsAndRemovals() public {
        _submit(alice);
        table.closeCycle();
        assertEq(table.currentCycleId(), 2);

        vm.prank(alice);
        vm.expectRevert(Contributions.CycleClosedForEdits.selector);
        table.update(1, "new", "d2", "research", "", "");

        vm.prank(alice);
        vm.expectRevert(Contributions.CycleClosedForEdits.selector);
        table.remove(1);

        vm.prank(alice);
        uint256 id = table.submit("t", "d", "area", "", "");
        assertEq(id, 2);
        (, uint256 cycleId,) = table.entries(2);
        assertEq(cycleId, 2);
        assertEq(table.countInCycle(2, alice), 1);
    }

    function test_onlyOwnerCanCloseCycle() public {
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", operator));
        table.closeCycle();
        assertEq(table.currentCycleId(), 1);
    }

    function test_operatorCanHideAndStrangerCannot() public {
        _submit(alice);
        table.setOperator(operator, true);

        string memory expected = string.concat("UPDATE ", table.getTableName(), " SET hidden=1 WHERE id=1");
        vm.expectCall(
            tableland, abi.encodeWithSignature("mutate(address,uint256,string)", address(table), TABLE_ID, expected)
        );
        vm.prank(operator);
        table.setHidden(1, true);

        _expectNoMutate();
        vm.prank(bob);
        vm.expectRevert(Contributions.NotOperator.selector);
        table.setHidden(1, false);
    }

    function test_ownerCanHide() public {
        _submit(alice);
        table.setHidden(1, true);
    }

    function test_hideMissingRowReverts() public {
        table.setOperator(operator, true);
        _expectNoMutate();
        vm.prank(operator);
        vm.expectRevert(Contributions.NotFound.selector);
        table.setHidden(1, true);
    }

    function test_recordResultsAfterClose() public {
        _submit(alice);
        vm.prank(bob);
        table.submit("t", "d", "area", "", "");
        table.closeCycle();

        uint256[] memory ids = new uint256[](2);
        uint256[] memory shares = new uint256[](2);
        string[] memory rewards = new string[](2);
        ids[0] = 1;
        ids[1] = 2;
        shares[0] = 7500;
        shares[1] = 2500;
        rewards[0] = '{"USDC":"10"}';
        rewards[1] = "{}";

        ITablelandTables.Statement[] memory statements = new ITablelandTables.Statement[](2);
        statements[0] = ITablelandTables.Statement(TABLE_ID, _resultSql(1, 7500, rewards[0]));
        statements[1] = ITablelandTables.Statement(TABLE_ID, _resultSql(2, 2500, rewards[1]));
        vm.expectCall(
            tableland, abi.encodeWithSignature("mutate(address,(uint256,string)[])", address(table), statements)
        );
        table.recordResults(1, ids, shares, rewards);

        (,, bool hasResult) = table.entries(1);
        assertTrue(hasResult);
    }

    function test_recordResultsRevertsForOpenCycle() public {
        _submit(alice);
        _expectNoBatch();
        vm.expectRevert(Contributions.CycleStillOpen.selector);
        table.recordResults(1, _ids(1), _shares(100), _rewards("{}"));
    }

    function test_recordResultsOnlyOwner() public {
        _submit(alice);
        table.closeCycle();
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", operator));
        table.recordResults(1, _ids(1), _shares(100), _rewards("{}"));
    }

    function test_recordResultsRevertsForWrongCycleUnknownIdAndSecondWrite() public {
        _submit(alice);
        table.closeCycle();
        vm.prank(alice);
        table.submit("t", "d", "area", "", "");

        vm.expectRevert(Contributions.WrongCycle.selector);
        table.recordResults(1, _ids(2), _shares(100), _rewards("{}"));

        vm.expectRevert(Contributions.NotFound.selector);
        table.recordResults(1, _ids(9), _shares(100), _rewards("{}"));

        table.recordResults(1, _ids(1), _shares(10_000), _rewards("{}"));
        vm.expectRevert(Contributions.ResultsExist.selector);
        table.recordResults(1, _ids(1), _shares(1), _rewards("{}"));
    }

    function test_recordResultsRejectsBadInputAndRollsBack() public {
        _submit(alice);
        table.closeCycle();

        vm.expectRevert(Contributions.EmptyBatch.selector);
        table.recordResults(1, new uint256[](0), new uint256[](0), new string[](0));

        vm.expectRevert(Contributions.LengthMismatch.selector);
        table.recordResults(1, _ids(1), new uint256[](0), _rewards("{}"));

        vm.expectRevert(Contributions.ShareTooLarge.selector);
        table.recordResults(1, _ids(1), _shares(10_001), _rewards("{}"));

        table.recordResults(1, _ids(1), _shares(10_000), _rewards("{}"));
        (,, bool hasResult) = table.entries(1);
        assertTrue(hasResult);
    }

    function test_rewardApostropheIsEscaped() public {
        _submit(alice);
        table.closeCycle();
        string memory reward = "it's paid";
        ITablelandTables.Statement[] memory statements = new ITablelandTables.Statement[](1);
        statements[0] = ITablelandTables.Statement(TABLE_ID, _resultSql(1, 100, reward));
        vm.expectCall(
            tableland, abi.encodeWithSignature("mutate(address,(uint256,string)[])", address(table), statements)
        );
        table.recordResults(1, _ids(1), _shares(100), _rewards(reward));
    }

    function test_adminSetters() public {
        table.setOperator(operator, true);
        assertTrue(table.operators(operator));
        table.setOperator(operator, false);
        assertFalse(table.operators(operator));

        vm.expectRevert(Contributions.ZeroAddress.selector);
        table.setOperator(address(0), true);

        MockCitizenNFT next = new MockCitizenNFT();
        table.setCitizenNFT(address(next));
        assertEq(address(table.citizenNFT()), address(next));
        vm.expectRevert(Contributions.ZeroAddress.selector);
        table.setCitizenNFT(address(0));

        table.setMaxPerCycle(0);
        assertEq(table.maxPerCycle(), 0);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", alice));
        table.setMaxPerCycle(1);
    }

    function testFuzz_quoteRoundTrip(string memory raw) public view {
        bytes memory b = bytes(raw);
        for (uint256 i; i < b.length; ++i) {
            vm.assume(b[i] != 0);
        }
        assertEq(_unescape(sql.quote(raw)), raw);
    }

    function test_quoteRejectsNul() public {
        vm.expectRevert(SqlString.InvalidText.selector);
        sql.quote(string(abi.encodePacked("a", bytes1(0))));
    }

    function _enroll(address who, uint64 expiresAt_) internal {
        citizen.set(who, uint256(uint160(who)), expiresAt_);
    }

    function _submit(address who) internal returns (uint256 id) {
        vm.prank(who);
        id = table.submit("t", "d", "area", "", "");
    }

    function _expectNoMutate() internal {
        vm.expectCall(tableland, abi.encodeWithSignature("mutate(address,uint256,string)"), 0);
    }

    function _expectNoBatch() internal {
        vm.expectCall(tableland, abi.encodeWithSignature("mutate(address,(uint256,string)[])"), 0);
    }

    function _resultSql(uint256 id, uint256 share, string memory reward) internal view returns (string memory) {
        return string.concat(
            "UPDATE ",
            table.getTableName(),
            " SET shareBps=",
            vm.toString(share),
            ",reward=",
            sql.quote(reward),
            ",updatedAt=",
            vm.toString(NOW),
            " WHERE id=",
            vm.toString(id)
        );
    }

    function _ids(uint256 id) internal pure returns (uint256[] memory ids) {
        ids = new uint256[](1);
        ids[0] = id;
    }

    function _shares(uint256 share) internal pure returns (uint256[] memory shares) {
        shares = new uint256[](1);
        shares[0] = share;
    }

    function _rewards(string memory reward) internal pure returns (string[] memory rewards) {
        rewards = new string[](1);
        rewards[0] = reward;
    }

    function _repeat(bytes1 c, uint256 n) internal pure returns (string memory) {
        bytes memory out = new bytes(n);
        for (uint256 i; i < n; ++i) {
            out[i] = c;
        }
        return string(out);
    }

    function _unescape(string memory quoted) internal pure returns (string memory) {
        bytes memory b = bytes(quoted);
        require(b.length >= 2 && b[0] == 0x27 && b[b.length - 1] == 0x27, "quotes");
        uint256 outLen;
        for (uint256 i = 1; i < b.length - 1; ++i) {
            if (b[i] == 0x27) {
                require(i + 1 < b.length - 1 && b[i + 1] == 0x27, "undoubled");
                ++i;
            }
            ++outLen;
        }
        bytes memory out = new bytes(outLen);
        uint256 j;
        for (uint256 i = 1; i < b.length - 1; ++i) {
            out[j++] = b[i];
            if (b[i] == 0x27) ++i;
        }
        return string(out);
    }
}
