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

    mapping(address => bool) public authorizedSigners;

    struct HatURIs {
        string adminHatURI;
        string managerHatURI;
        string memberHatURI;
    }

    struct TeamMetadata {
        string name;
        string bio;
        string image;
        string twitter;
        string communications;
        string website;
        string _view;
        string formId;
    }

    constructor(address _hats, address _hatsModuleFactory, address _hatsPassthrough, address _moonDAOTeam, address _gnosisSingleton, address _gnosisSafeProxyFactory, address _table, address _whitelist, address[] memory _authorizedSigners) Ownable(msg.sender) {
        hats = IHats(_hats);
        moonDAOTeam = MoonDAOTeam(_moonDAOTeam);
        gnosisSingleton = _gnosisSingleton;
        hatsPassthrough = _hatsPassthrough;
        gnosisSafeProxyFactory = GnosisSafeProxyFactory(_gnosisSafeProxyFactory);
        hatsModuleFactory = HatsModuleFactory(_hatsModuleFactory);

        table = MoonDaoTeamTableland(_table);
        whitelist = Whitelist(_whitelist);
        for (uint256 i = 0; i < _authorizedSigners.length; i++) {
            authorizedSigners[_authorizedSigners[i]] = true;
        }
    }

    function setAuthorizedSigner(address _authorizedSigner, bool _authorized) external onlyOwner {
        authorizedSigners[_authorizedSigner] = _authorized;
    }

    modifier onlyAuthorizedSigner() {
        require(authorizedSigners[msg.sender], "Only authorized signer can call this function");
        _;
    }

    function setMoonDAOTeam(address _moonDAOTeam) external onlyOwner() {
        moonDAOTeam = MoonDAOTeam(_moonDAOTeam);
    }

    function setMoonDaoTeamAdminHatId(uint256 _MoonDaoTeamAdminHatId) external onlyOwner() {
        MoonDaoTeamAdminHatId = _MoonDaoTeamAdminHatId;
    }

    function setGnosisSingleton(address _gnosisSingleton) external onlyOwner() {
        gnosisSingleton = _gnosisSingleton;
    }

    function setGnosisSafeProxyFactory(address _gnosisSafeProxyFactory) external onlyOwner() {
        gnosisSafeProxyFactory = GnosisSafeProxyFactory(_gnosisSafeProxyFactory);
    }

    function setHats(address _hats) external onlyOwner() {
        hats = IHats(_hats);
    }

    function setHatsModuleFactory(address _hatsModuleFactory) external onlyOwner() {
        hatsModuleFactory = HatsModuleFactory(_hatsModuleFactory);
    }

    function setHatsPassthrough(address _hatsPassthrough) external onlyOwner() {
        hatsPassthrough = _hatsPassthrough;
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

    function createMoonDAOTeamFor(
        address creator,
        HatURIs memory hatURIs,
        TeamMetadata calldata metadata,
        address[] memory members
    ) external payable onlyAuthorizedSigner returns (uint256 tokenId, uint256 childHatId) {
        return _createMoonDAOTeam(creator, hatURIs, metadata, members);
    }

    function createMoonDAOTeam(
        HatURIs memory hatURIs,
        TeamMetadata calldata metadata,
        address[] memory members
    ) external payable returns (uint256 tokenId, uint256 childHatId) {
        return _createMoonDAOTeam(msg.sender, hatURIs, metadata, members);
    }

    function _createMoonDAOTeam(
        address creator,
        HatURIs memory hatURIs,
        TeamMetadata calldata metadata,
        address[] memory members
    ) internal returns (uint256 tokenId, uint256 childHatId) {

        require(whitelist.isWhitelisted(creator) || openAccess, "Only whitelisted addresses can create a MoonDAO Team");
        
        bytes memory safeCallData = constructSafeCallData(creator, members);
        GnosisSafeProxy gnosisSafe = gnosisSafeProxyFactory.createProxy(gnosisSingleton, safeCallData);
        
        //admin hat
        uint256 teamAdminHat = hats.createHat(MoonDaoTeamAdminHatId, hatURIs.adminHatURI, 1, address(gnosisSafe), address(gnosisSafe), true, "");
        hats.mintHat(teamAdminHat, address(this));

        //manager hat
        uint256 teamManagerHat = hats.createHat(teamAdminHat, hatURIs.managerHatURI, 8, address(gnosisSafe), address(gnosisSafe), true, "");

        hats.mintHat(teamManagerHat, creator);
        hats.transferHat(teamAdminHat, address(this), address(gnosisSafe));

        //member hat
        uint256 teamMemberHat = hats.createHat(teamManagerHat, hatURIs.memberHatURI, 1000, address(gnosisSafe), address(gnosisSafe), true, '');

        //member hat passthrough module (allow manager hat to control member hat)
        PassthroughModule memberPassthroughModule = PassthroughModule(deployModuleInstance(hatsModuleFactory, hatsPassthrough, teamMemberHat, abi.encodePacked(teamManagerHat), "", 0));

        hats.changeHatEligibility(teamMemberHat, address(memberPassthroughModule));
        hats.changeHatToggle(teamMemberHat, address(memberPassthroughModule));

        //payment splitter
        address[] memory payees = new address[](2);
        payees[0] = address(gnosisSafe);
        payees[1] = creator;
        uint256[] memory shares = new uint256[](2);
        shares[0] = 9900;
        shares[1] = 100;
        PaymentSplitter split = new PaymentSplitter(payees, shares);

        //mint
        tokenId = moonDAOTeam.mintTo{value: msg.value}(address(gnosisSafe), creator, teamAdminHat, teamManagerHat, teamMemberHat, address(memberPassthroughModule), address(split));

        table.insertIntoTable(tokenId, metadata.name, metadata.bio, metadata.image, metadata.twitter, metadata.communications, metadata.website, metadata._view, metadata.formId);
    }

    function constructSafeCallData(address caller, address[] memory members) internal returns (bytes memory) {
        uint256 maxOwners = 5;
        uint256 ownersLength = members.length + 1 > maxOwners ? maxOwners : members.length + 1;
        address[] memory owners = new address[](ownersLength);
        owners[0] = caller;
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
