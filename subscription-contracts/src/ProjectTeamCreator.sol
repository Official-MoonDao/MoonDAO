// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import { ProjectTeam } from "./ProjectTeam.sol";
import "@hats/Interfaces/IHats.sol";
import "./GnosisSafeProxyFactory.sol";
import "./GnosisSafeProxy.sol";
import {Project} from "./tables/Project.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {PaymentSplitter} from "./PaymentSplitter.sol";
import {HatsModuleFactory} from "@hats-module/HatsModuleFactory.sol";
import {PassthroughModule} from "./PassthroughModule.sol";
import {deployModuleInstance} from "@hats-module/utils/DeployFunctions.sol";

contract ProjectTeamCreator is Ownable {

    IHats internal hats;

    ProjectTeam internal projectTeam;

    address internal gnosisSingleton;

    address internal hatsPassthrough;

    GnosisSafeProxyFactory internal gnosisSafeProxyFactory;

    HatsModuleFactory internal hatsModuleFactory;

    Project public table;

    uint256 public projectTeamAdminHatId;

    constructor(address _hats, address _hatsModuleFactory, address _hatsPassthrough, address _projectTeam, address _gnosisSingleton, address _gnosisSafeProxyFactory, address _table) Ownable(msg.sender) {
        hats = IHats(_hats);
        projectTeam = ProjectTeam(_projectTeam);
        gnosisSingleton = _gnosisSingleton;
        hatsPassthrough = _hatsPassthrough;
        gnosisSafeProxyFactory = GnosisSafeProxyFactory(_gnosisSafeProxyFactory);
        hatsModuleFactory = HatsModuleFactory(_hatsModuleFactory);

        table = Project(_table);
    }

    function setProjectTeamAdminHatId(uint256 _projectTeamAdminHatId) external onlyOwner() {
        projectTeamAdminHatId = _projectTeamAdminHatId;
    }

    function createProjectTeam(string memory adminHatURI, string memory managerHatURI, string memory memberHatURI, string calldata name, string calldata description, string calldata image, uint256 quarter, uint256 year, uint256 MDP, string calldata proposalIPFS, string calldata proposalLink, string calldata upfrontPayments, address lead, address[] memory members, address[] memory signers) external onlyOwner() returns (uint256 tokenId, uint256 childHatId) {
        bytes memory safeCallData = constructSafeCallData(signers);
        GnosisSafeProxy gnosisSafe = gnosisSafeProxyFactory.createProxy(gnosisSingleton, safeCallData);

        //admin hat
        uint256 projectAdminHat = hats.createHat(projectTeamAdminHatId, adminHatURI, 1, address(gnosisSafe), address(gnosisSafe), true, "");
        hats.mintHat(projectAdminHat, address(this));

        //manager hat
        uint256 projectManagerHat = hats.createHat(projectAdminHat, managerHatURI, 8, address(gnosisSafe), address(gnosisSafe), true, "");

        hats.mintHat(projectManagerHat, lead);
        // loop through members and mint hats, before the safe has control
        hats.transferHat(projectAdminHat, address(this), address(gnosisSafe));

        //member hat
        uint256 projectContributorHat = hats.createHat(projectManagerHat, memberHatURI, 1000, address(gnosisSafe), address(gnosisSafe), true, '');
        for (uint i = 0; i < members.length; i++) {
            hats.mintHat(projectContributorHat, members[i]);
        }

        //member hat passthrough module (allow admin hat to control member hat)
        PassthroughModule memberPassthroughModule = PassthroughModule(deployModuleInstance(hatsModuleFactory, hatsPassthrough, projectContributorHat, abi.encodePacked(projectManagerHat), "", 0));


        hats.changeHatEligibility(projectContributorHat, address(memberPassthroughModule));
        hats.changeHatToggle(projectContributorHat, address(memberPassthroughModule));


        //mint
        tokenId = projectTeam.mintTo(address(gnosisSafe), lead, projectAdminHat, projectManagerHat, projectContributorHat, address(memberPassthroughModule));

        table.insertIntoTable(tokenId, name, description, image, quarter, year, MDP, proposalIPFS, proposalLink, "", "", "", upfrontPayments, 2, 0);
    }

    function constructSafeCallData(address[] memory signers) internal returns (bytes memory) {
        uint256 threshold = signers.length / 2 + 1;
        //see https://github.com/safe-global/safe-smart-account/blob/main/contracts/Safe.sol#L84
        bytes memory proxyInitData = abi.encodeWithSelector(
            // function selector (setup)
            0xb63e800d,
            signers,
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
