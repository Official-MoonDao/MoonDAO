// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title  TableOperatorsTest
 * @notice Comprehensive audit & regression tests for the `operators` allowlist
 *         added to JobBoardTable and MarketplaceTable.
 *
 * SECURITY ANALYSIS
 * ══════════════════
 * Attack surface added:
 *   1. setOperator(address, bool) – guarded by onlyOwner
 *   2. Operators gain write access to ALL teams (super-manager design intent)
 *   3. Operators cannot call setOperator themselves – no self-escalation
 *   4. Operators cannot transfer ownership
 *   5. Revoking is instant (setOperator(addr, false))
 *
 * Unchanged behaviour:
 *   • idToTeamId integrity check on update/delete preserved
 *   • Tableland controller mapping unchanged
 *   • All existing team-manager paths still work
 *
 * COVERAGE
 * ════════
 * A1–A17  JobBoardTable access control + invariants
 * B1–B13  MarketplaceTable access control
 * C1–C3   State invariants
 */

import "forge-std/Test.sol";
import "../src/tables/JobBoardTable.sol";
import "../src/tables/MarketplaceTable.sol";
import "../src/GnosisSafeProxyFactory.sol";
import {MoonDAOTeamCreator} from "../src/MoonDAOTeamCreator.sol";
import {PassthroughModule} from "../src/PassthroughModule.sol";
import {IHats} from "@hats/Interfaces/IHats.sol";
import {Hats} from "@hats/Hats.sol";
import {HatsModuleFactory} from "@hats-module/HatsModuleFactory.sol";
import {deployModuleFactory} from "@hats-module/utils/DeployFunctions.sol";
import {Whitelist} from "../src/Whitelist.sol";
import {MoonDAOTeamTable} from "../src/tables/TeamTableV2.sol";

contract TableOperatorsTest is Test {
    // ── Actors ──────────────────────────────────────────────────────────────
    address internal deployer = address(this);
    address internal pablo    = address(0x1001);
    address internal ryan     = address(0x1002);
    address internal manager  = address(0x1003);
    address internal stranger = address(0x1004);

    bytes32 internal constant SALT = bytes32(abi.encode(0x4a75));

    // Local Tableland registry (chain id 31337)
    address internal constant TABLELAND = 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512;

    MoonDAOTeam        internal team;
    JobBoardTable      internal jobBoard;
    MarketplaceTable   internal marketplace;
    MoonDAOTeamCreator internal creator;

    uint256 internal teamId;

    // ══════════════════════════════════════════════════════════════════════
    function setUp() public {
        vm.deal(deployer, 10 ether);
        vm.deal(manager,  10 ether);

        // Mock Tableland FIRST – all table contract constructors call it
        vm.etch(TABLELAND, hex"00");
        vm.mockCall(TABLELAND,
            abi.encodeWithSignature("create(address,string)"),
            abi.encode(uint256(1)));
        vm.mockCall(TABLELAND,
            abi.encodeWithSignature("mutate(address,uint256,string)"),
            abi.encode());
        vm.mockCall(TABLELAND,
            abi.encodeWithSignature("setController(address,uint256,address)"),
            abi.encode());

        Hats hatsBase = new Hats("", "");
        IHats hats = IHats(address(hatsBase));
        HatsModuleFactory hatsFactory = deployModuleFactory(hats, SALT, "");
        PassthroughModule passthrough = new PassthroughModule("");
        address gnosisSafeSingleton = address(0x3E5c63644E683549055b9Be8653de26E0B4CD36E);
        GnosisSafeProxyFactory proxyFactory = new GnosisSafeProxyFactory();

        Whitelist whitelist    = new Whitelist();
        Whitelist discountList = new Whitelist();
        MoonDAOTeamTable teamTable = new MoonDAOTeamTable("MoonDAOTeamTable");

        team = new MoonDAOTeam("test", "TEST", deployer, address(hatsBase), address(discountList));
        address[] memory signers = new address[](0);
        creator = new MoonDAOTeamCreator(
            address(hatsBase), address(hatsFactory), address(passthrough),
            address(team), gnosisSafeSingleton, address(proxyFactory),
            address(teamTable), address(whitelist), signers
        );
        creator.setOpenAccess(true);
        teamTable.setMoonDaoTeam(address(team));
        teamTable.setTeamCreatorAddress(address(creator));

        uint256 topHatId   = hats.mintTopHat(deployer, "", "");
        uint256 adminHatId = hats.createHat(topHatId, "", 1, deployer, deployer, true, "");
        creator.setMoonDaoTeamAdminHatId(adminHatId);
        team.setMoonDaoCreator(address(creator));
        hats.mintHat(adminHatId, address(creator));

        // Create a real team with `manager` as its admin
        vm.startPrank(manager);
        MoonDAOTeamCreator.HatURIs memory hatURIs = MoonDAOTeamCreator.HatURIs({
            adminHatURI: "", managerHatURI: "", memberHatURI: ""
        });
        MoonDAOTeamCreator.TeamMetadata memory metadata = MoonDAOTeamCreator.TeamMetadata({
            name: "Test Team", bio: "bio", image: "", twitter: "",
            communications: "", website: "", _view: "public", formId: ""
        });
        (teamId, ) = creator.createMoonDAOTeam{value: 0.555 ether}(hatURIs, metadata, new address[](0));
        vm.stopPrank();

        jobBoard    = new JobBoardTable("JOBBOARD_TEST");
        marketplace = new MarketplaceTable("MARKETPLACE_TEST");

        jobBoard.setMoonDaoTeam(address(team));
        marketplace.setMoonDaoTeam(address(team));

        // Mirror production: Pablo and Ryan are super-manager operators
        jobBoard.setOperator(pablo, true);
        jobBoard.setOperator(ryan, true);
        marketplace.setOperator(pablo, true);
        marketplace.setOperator(ryan, true);
    }

    // ── Helpers ─────────────────────────────────────────────────────────────
    function _insertJob(address caller, uint256 _teamId) internal {
        vm.prank(caller);
        jobBoard.insertIntoTable(
            "Job Title", "Description", _teamId,
            "engineering", "", block.timestamp + 30 days,
            block.timestamp, "jobs@moondao.com"
        );
    }

    function _insertListing(address caller, uint256 _teamId) internal {
        vm.prank(caller);
        marketplace.insertIntoTable(
            "NFT", "A collectible", "ipfs://img",
            _teamId, "100", "USDC",
            0, block.timestamp + 30 days, block.timestamp,
            "art", "", "false"
        );
    }

    // ══════════════════════════════════════════════════════════════════════
    // A. JobBoardTable
    // ══════════════════════════════════════════════════════════════════════

    /// A1 – Owner inserts without being a team manager
    function test_A1_ownerCanInsert() public {
        _insertJob(deployer, 0);
        assertEq(jobBoard.currId(), 1);
    }

    /// A2 – Pablo (operator) inserts without being a team manager
    function test_A2_pabloOperatorCanInsert() public {
        _insertJob(pablo, 0);
        assertEq(jobBoard.currId(), 1);
    }

    /// A2b – Ryan (operator) inserts without being a team manager
    function test_A2b_ryanOperatorCanInsert() public {
        _insertJob(ryan, 0);
        assertEq(jobBoard.currId(), 1);
    }

    /// A3 – Hat-wearing manager inserts for their own team
    function test_A3_teamManagerCanInsert() public {
        vm.prank(manager);
        jobBoard.insertIntoTable(
            "Manager Post", "desc", teamId, "", "",
            block.timestamp + 1 days, block.timestamp, "mgr@team.com"
        );
        assertEq(jobBoard.currId(), 1);
    }

    /// A4 – Stranger is rejected
    function test_A4_strangerCannotInsert() public {
        vm.prank(stranger);
        vm.expectRevert();
        jobBoard.insertIntoTable("hack", "d", 0, "", "", block.timestamp, block.timestamp, "x");
    }

    /// A5 – Owner updates
    function test_A5_ownerCanUpdate() public {
        _insertJob(deployer, 0);
        jobBoard.updateTable(0, "Updated", "d", 0, "", "", block.timestamp + 1 days, block.timestamp, "x");
    }

    /// A6 – Operator updates any row
    function test_A6_operatorCanUpdate() public {
        _insertJob(deployer, 0);
        vm.prank(pablo);
        jobBoard.updateTable(0, "Pablo Update", "d", 0, "", "", block.timestamp + 1 days, block.timestamp, "x");
    }

    /// A7 – Stranger cannot update
    function test_A7_strangerCannotUpdate() public {
        _insertJob(deployer, 0);
        vm.prank(stranger);
        vm.expectRevert();
        jobBoard.updateTable(0, "hack", "d", 0, "", "", block.timestamp, block.timestamp, "x");
    }

    /// A8 – Owner deletes
    function test_A8_ownerCanDelete() public {
        _insertJob(deployer, 0);
        jobBoard.deleteFromTable(0, 0);
    }

    /// A9 – Operator deletes
    function test_A9_operatorCanDelete() public {
        _insertJob(deployer, 0);
        vm.prank(ryan);
        jobBoard.deleteFromTable(0, 0);
    }

    /// A10 – Stranger cannot delete
    function test_A10_strangerCannotDelete() public {
        _insertJob(deployer, 0);
        vm.prank(stranger);
        vm.expectRevert();
        jobBoard.deleteFromTable(0, 0);
    }

    /// A11 – Revoked operator loses write access immediately
    function test_A11_revokedOperatorLosesAccess() public {
        assertTrue(jobBoard.operators(pablo));
        jobBoard.setOperator(pablo, false);
        assertFalse(jobBoard.operators(pablo));

        vm.prank(pablo);
        vm.expectRevert();
        jobBoard.insertIntoTable("hack", "d", 0, "", "", block.timestamp, block.timestamp, "x");
    }

    /// A12 – setOperator is onlyOwner (stranger rejected)
    function test_A12_setOperatorIsOnlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert();
        jobBoard.setOperator(stranger, true);
    }

    /// A12b – Operator cannot grant operator status to others
    function test_A12b_operatorCannotGrantOthers() public {
        vm.prank(pablo);
        vm.expectRevert();
        jobBoard.setOperator(stranger, true);
    }

    /// A13 – OperatorSet event on grant
    function test_A13_operatorSetEventOnGrant() public {
        address newOp = address(0x9999);
        vm.expectEmit(true, false, false, true);
        emit JobBoardTable.OperatorSet(newOp, true);
        jobBoard.setOperator(newOp, true);
    }

    /// A13b – OperatorSet event on revoke
    function test_A13b_operatorSetEventOnRevoke() public {
        vm.expectEmit(true, false, false, true);
        emit JobBoardTable.OperatorSet(pablo, false);
        jobBoard.setOperator(pablo, false);
    }

    /// A14 – Update rejects mismatched teamId
    function test_A14_updateRejectsTeamIdMismatch() public {
        _insertJob(deployer, 0);
        vm.expectRevert(bytes("You can only update job post by your team"));
        jobBoard.updateTable(0, "t", "d", 999, "", "", block.timestamp, block.timestamp, "x");
    }

    /// A15 – Delete rejects mismatched teamId
    function test_A15_deleteRejectsTeamIdMismatch() public {
        _insertJob(deployer, 0);
        vm.expectRevert(bytes("You can only delete job post by your team"));
        jobBoard.deleteFromTable(0, 999);
    }

    /// A16 – currId increments per insert
    function test_A16_currIdIncrements() public {
        assertEq(jobBoard.currId(), 0);
        _insertJob(deployer, 0);
        assertEq(jobBoard.currId(), 1);
        _insertJob(pablo, 0);
        assertEq(jobBoard.currId(), 2);
        _insertJob(ryan, 0);
        assertEq(jobBoard.currId(), 3);
    }

    /// A17 – idToTeamId mapping is written on insert
    function test_A17_idToTeamIdMappingWritten() public {
        _insertJob(deployer, 0);
        _insertJob(pablo, teamId);
        assertEq(jobBoard.idToTeamId(0), 0,      "row 0 maps to teamId 0");
        assertEq(jobBoard.idToTeamId(1), teamId,  "row 1 maps to real teamId");
    }

    // ══════════════════════════════════════════════════════════════════════
    // B. MarketplaceTable
    // ══════════════════════════════════════════════════════════════════════

    /// B1 – Owner inserts
    function test_B1_ownerCanInsertListing() public {
        _insertListing(deployer, 0);
        assertEq(marketplace.currId(), 1);
    }

    /// B2 – Pablo operator inserts
    function test_B2_pabloOperatorCanInsertListing() public {
        _insertListing(pablo, 0);
        assertEq(marketplace.currId(), 1);
    }

    /// B2b – Ryan operator inserts
    function test_B2b_ryanOperatorCanInsertListing() public {
        _insertListing(ryan, 0);
        assertEq(marketplace.currId(), 1);
    }

    /// B3 – Hat-wearing manager inserts for their team
    function test_B3_teamManagerCanInsertListing() public {
        vm.prank(manager);
        marketplace.insertIntoTable(
            "NFT", "desc", "ipfs://img", teamId, "10", "USDC",
            0, block.timestamp + 30 days, block.timestamp, "", "", "false"
        );
        assertEq(marketplace.currId(), 1);
    }

    /// B4 – Stranger rejected
    function test_B4_strangerCannotInsertListing() public {
        vm.prank(stranger);
        vm.expectRevert();
        marketplace.insertIntoTable("hack","d","",0,"0","ETH",0,0,block.timestamp,"","","false");
    }

    /// B5 – Owner updates
    function test_B5_ownerCanUpdateListing() public {
        _insertListing(deployer, 0);
        marketplace.updateTable(0,"Updated","d","",0,"200","USDC",0,0,block.timestamp,"","","false");
    }

    /// B6 – Operator updates
    function test_B6_operatorCanUpdateListing() public {
        _insertListing(deployer, 0);
        vm.prank(pablo);
        marketplace.updateTable(0,"Pablo","d","",0,"200","USDC",0,0,block.timestamp,"","","false");
    }

    /// B7 – Stranger cannot update
    function test_B7_strangerCannotUpdateListing() public {
        _insertListing(deployer, 0);
        vm.prank(stranger);
        vm.expectRevert();
        marketplace.updateTable(0,"hack","d","",0,"0","ETH",0,0,block.timestamp,"","","false");
    }

    /// B8 – Owner deletes
    function test_B8_ownerCanDeleteListing() public {
        _insertListing(deployer, 0);
        marketplace.deleteFromTable(0, 0);
    }

    /// B9 – Operator deletes
    function test_B9_operatorCanDeleteListing() public {
        _insertListing(deployer, 0);
        vm.prank(ryan);
        marketplace.deleteFromTable(0, 0);
    }

    /// B10 – Stranger cannot delete
    function test_B10_strangerCannotDeleteListing() public {
        _insertListing(deployer, 0);
        vm.prank(stranger);
        vm.expectRevert();
        marketplace.deleteFromTable(0, 0);
    }

    /// B11 – Revoked operator loses access
    function test_B11_revokedOperatorLosesListingAccess() public {
        marketplace.setOperator(ryan, false);
        assertFalse(marketplace.operators(ryan));

        vm.prank(ryan);
        vm.expectRevert();
        marketplace.insertIntoTable("hack","d","",0,"0","ETH",0,0,0,"","","false");
    }

    /// B12 – setOperator is onlyOwner
    function test_B12_setOperatorIsOnlyOwner_Marketplace() public {
        vm.prank(stranger);
        vm.expectRevert();
        marketplace.setOperator(stranger, true);
    }

    /// B13 – OperatorSet events
    function test_B13_operatorSetEvents_Marketplace() public {
        address newOp = address(0x8888);
        vm.expectEmit(true, false, false, true);
        emit MarketplaceTable.OperatorSet(newOp, true);
        marketplace.setOperator(newOp, true);

        vm.expectEmit(true, false, false, true);
        emit MarketplaceTable.OperatorSet(newOp, false);
        marketplace.setOperator(newOp, false);
    }

    // ══════════════════════════════════════════════════════════════════════
    // C. State invariants
    // ══════════════════════════════════════════════════════════════════════

    /// C1 – Production operators (Pablo + Ryan) are registered
    function test_C1_pabloAndRyanAreOperators() public view {
        assertTrue(jobBoard.operators(pablo),    "pablo not operator on jobBoard");
        assertTrue(jobBoard.operators(ryan),     "ryan not operator on jobBoard");
        assertTrue(marketplace.operators(pablo), "pablo not operator on marketplace");
        assertTrue(marketplace.operators(ryan),  "ryan not operator on marketplace");
    }

    /// C2 – MoonDAOTeam set on both contracts
    function test_C2_moonDaoTeamSet() public view {
        assertEq(address(jobBoard._moonDaoTeam()),    address(team));
        assertEq(address(marketplace._moonDaoTeam()), address(team));
    }

    /// C3 – Fresh deployment starts with currId == 0
    function test_C3_currIdStartsAtZero() public view {
        assertEq(jobBoard.currId(),    0);
        assertEq(marketplace.currId(), 0);
    }
}
