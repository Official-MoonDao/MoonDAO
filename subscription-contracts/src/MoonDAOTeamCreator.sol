// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import { MoonDAOTeam } from "./ERC5643.sol";
import "@hats/Interfaces/IHats.sol";
import "./GnosisSafeProxyFactory.sol";
import "./GnosisSafeProxy.sol";
import {MoonDaoTeamTableland} from "./tables/MoonDaoTeamTableland.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Whitelist} from "./Whitelist.sol";
import {PaymentSplitter} from "./PaymentSplitter.sol";
import {HatsModuleFactory} from "@hats-module/HatsModuleFactory.sol";
import {PassthroughModule} from "./PassthroughModule.sol";
import {deployModuleInstance} from "@hats-module/utils/DeployFunctions.sol";

contract MoonDAOTeamCreator is Ownable {

    IHats internal hats;

    MoonDAOTeam internal moonDAOTeam;

    address internal gnosisSingleton;

    address internal hatsPassthrough;

    GnosisSafeProxyFactory internal gnosisSafeProxyFactory;

    HatsModuleFactory internal hatsModuleFactory;

    MoonDaoTeamTableland public table;

    uint256 public MoonDaoTeamAdminHatId;

    Whitelist internal whitelist;

    bool public openAccess;

    constructor(address _hats, address _hatsModuleFactory, address _hatsPassthrough, address _moonDAOTeam, address _gnosisSingleton, address _gnosisSafeProxyFactory, address _table, address _whitelist) Ownable(msg.sender) {
        hats = IHats(_hats);
        moonDAOTeam = MoonDAOTeam(_moonDAOTeam);
        gnosisSingleton = _gnosisSingleton;
        hatsPassthrough = _hatsPassthrough;
        gnosisSafeProxyFactory = GnosisSafeProxyFactory(_gnosisSafeProxyFactory);
        hatsModuleFactory = HatsModuleFactory(_hatsModuleFactory);

        table = MoonDaoTeamTableland(_table);
        whitelist = Whitelist(_whitelist);
    }

    function setMoonDaoTeamAdminHatId(uint256 _MoonDaoTeamAdminHatId) external onlyOwner() {
        MoonDaoTeamAdminHatId = _MoonDaoTeamAdminHatId;
    }

    function setMoonDaoTeamTable(address _table) external onlyOwner() {
        table = MoonDaoTeamTableland(_table);
    }

    function setWhitelist(address _whitelist) external onlyOwner() {
        whitelist = Whitelist(_whitelist);
    }

    function setOpenAccess(bool _openAccess) external onlyOwner() {
        openAccess = _openAccess;
    }

    function createMoonDAOTeam(string memory adminHatURI, string memory managerHatURI, string memory memberHatURI, string calldata name, string calldata bio, string calldata image, string calldata twitter, string calldata communications, string calldata website, string calldata _view, string memory formId, address[] memory members) external payable returns (uint256 tokenId, uint256 childHatId) {

        require(whitelist.isWhitelisted(msg.sender) || openAccess, "Only whitelisted addresses can create a MoonDAO Team");
        

        bytes memory safeCallData = constructSafeCallData(msg.sender, members);
        GnosisSafeProxy gnosisSafe = gnosisSafeProxyFactory.createProxy(gnosisSingleton, safeCallData);
        
        //admin hat
        uint256 teamAdminHat = hats.createHat(MoonDaoTeamAdminHatId, adminHatURI, 1, address(gnosisSafe), address(gnosisSafe), true, "");
        hats.mintHat(teamAdminHat, address(this));

        //manager hat
        uint256 teamManagerHat = hats.createHat(teamAdminHat, managerHatURI, 8, address(gnosisSafe), address(gnosisSafe), true, "");

        hats.mintHat(teamManagerHat, msg.sender);
        hats.transferHat(teamAdminHat, address(this), address(gnosisSafe));

        //member hat
        uint256 teamMemberHat = hats.createHat(teamManagerHat, memberHatURI, 1000, address(gnosisSafe), address(gnosisSafe), true, '');

        //member hat passthrough module (allow admin hat to control member hat)
        PassthroughModule memberPassthroughModule = PassthroughModule(deployModuleInstance(hatsModuleFactory, hatsPassthrough, teamMemberHat, abi.encodePacked(teamManagerHat), "", 0));


        hats.changeHatEligibility(teamMemberHat, address(memberPassthroughModule));
        hats.changeHatToggle(teamMemberHat, address(memberPassthroughModule));

        //payment splitter
        address[] memory payees = new address[](2);
        payees[0] = address(gnosisSafe);
        payees[1] = msg.sender;
        uint256[] memory shares = new uint256[](2);
        shares[0] = 9900;
        shares[1] = 100;
        PaymentSplitter split = new PaymentSplitter(payees, shares);

        //mint
        tokenId = moonDAOTeam.mintTo{value: msg.value}(address(gnosisSafe), msg.sender, teamAdminHat, teamManagerHat, teamMemberHat, address(memberPassthroughModule), address(split));

        table.insertIntoTable(tokenId, name, bio, image, twitter, communications, website, _view, formId);
    }

    function constructSafeCallData(address caller, address[] memory members) internal returns (bytes memory) {
        uint256 maxOwners = 5;
        uint256 ownersLength = members.length + 1 > maxOwners ? maxOwners : members.length + 1;
        address[] memory owners = new address[](ownersLength);
        owners[0] = msg.sender;
        for (uint i = 1; i < ownersLength; i++) {
            owners[i] = members[i - 1];
        }
        uint256 threshold = owners.length / 2 + 1;
        //see https://github.com/safe-global/safe-smart-account/blob/main/contracts/Safe.sol#L84
        bytes memory proxyInitData = abi.encodeWithSelector(
            // function selector (setup)
            0xb63e800d,
            owners,
            threshold,
            // to
            address(0x0),
            // data
            new bytes(0),
            // fallback handler
            address(0xf48f2B2d2a534e402487b3ee7C18c33Aec0Fe5e4),
            // payment token
            address(0x0),
            // payment
            0,
            // paymentReceiver
            address(0x0)
        );
        return proxyInitData;
    }


}
