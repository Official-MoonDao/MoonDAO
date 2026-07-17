// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {MoonDAOTeam} from "./ERC5643.sol";
import {TeamMinterRouter} from "./TeamMinterRouter.sol";
import {TeamRoleRegistry} from "./TeamRoleRegistry.sol";
import "./GnosisSafeProxyFactory.sol";
import "./GnosisSafeProxy.sol";
import {MoonDaoTeamTableland} from "./tables/MoonDaoTeamTableland.sol";
import {ProjectV2} from "./tables/ProjectV2.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {PaymentSplitter} from "./PaymentSplitter.sol";

/**
 * @title ProjectTeamCreatorV2
 * @notice Governance-driven (onlyOwner) creator for projects that are teams under the hood.
 *         Mints a MoonDAOTeam NFT via the TeamMinterRouter, records roles in the
 *         TeamRoleRegistry (lead = MANAGER, members = MEMBER), writes the team profile row,
 *         and writes the project governance overlay row into ProjectV2.
 *
 *         Because a project is now a real team, jobs / marketplace / launchpad work for it
 *         with no changes to those feature contracts.
 */
contract ProjectTeamCreatorV2 is Ownable {
    uint256 public constant PROJECT_ACTIVE = 2;

    MoonDAOTeam internal moonDAOTeam;
    TeamMinterRouter internal minter;
    TeamRoleRegistry internal registry;

    address internal gnosisSingleton;
    GnosisSafeProxyFactory internal gnosisSafeProxyFactory;

    MoonDaoTeamTableland public teamTable;
    ProjectV2 public projectTable;

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

    struct ProjectMetadata {
        uint256 id;
        string name;
        string description;
        string image;
        uint256 quarter;
        uint256 year;
        uint256 MDP;
        string proposalIPFS;
        string proposalLink;
        string upfrontPayments;
    }

    constructor(
        address _moonDAOTeam,
        address _minter,
        address _registry,
        address _gnosisSingleton,
        address _gnosisSafeProxyFactory,
        address _teamTable,
        address _projectTable
    ) Ownable(msg.sender) {
        moonDAOTeam = MoonDAOTeam(_moonDAOTeam);
        minter = TeamMinterRouter(_minter);
        registry = TeamRoleRegistry(_registry);
        gnosisSingleton = _gnosisSingleton;
        gnosisSafeProxyFactory = GnosisSafeProxyFactory(_gnosisSafeProxyFactory);
        teamTable = MoonDaoTeamTableland(_teamTable);
        projectTable = ProjectV2(_projectTable);
    }

    function setMoonDAOTeam(address _moonDAOTeam) external onlyOwner {
        moonDAOTeam = MoonDAOTeam(_moonDAOTeam);
    }

    function setMinter(address _minter) external onlyOwner {
        minter = TeamMinterRouter(_minter);
    }

    function setRegistry(address _registry) external onlyOwner {
        registry = TeamRoleRegistry(_registry);
    }

    function setGnosisSingleton(address _gnosisSingleton) external onlyOwner {
        gnosisSingleton = _gnosisSingleton;
    }

    function setGnosisSafeProxyFactory(address _gnosisSafeProxyFactory) external onlyOwner {
        gnosisSafeProxyFactory = GnosisSafeProxyFactory(_gnosisSafeProxyFactory);
    }

    function setTeamTable(address _teamTable) external onlyOwner {
        teamTable = MoonDaoTeamTableland(_teamTable);
    }

    function setProjectTable(address _projectTable) external onlyOwner {
        projectTable = ProjectV2(_projectTable);
    }

    function createProjectTeam(
        TeamMetadata calldata teamMetadata,
        ProjectMetadata calldata projectMetadata,
        address lead,
        address[] memory members,
        address[] memory signers
    ) external payable onlyOwner returns (uint256 tokenId) {
        require(signers.length > 0, "No signers");
        bytes memory safeCallData = constructSafeCallData(signers);
        GnosisSafeProxy gnosisSafe = gnosisSafeProxyFactory.createProxy(gnosisSingleton, safeCallData);

        address[] memory payees = new address[](2);
        payees[0] = address(gnosisSafe);
        payees[1] = lead;
        uint256[] memory shares = new uint256[](2);
        shares[0] = 9900;
        shares[1] = 100;
        PaymentSplitter split = new PaymentSplitter(payees, shares);

        tokenId = minter.mintTo{value: msg.value}(
            address(gnosisSafe),
            lead,
            0,
            0,
            0,
            address(0),
            address(split)
        );

        registry.setRegistryBased(tokenId, true);
        registry.setRole(tokenId, lead, registry.MANAGER());
        for (uint256 i = 0; i < members.length; i++) {
            if (members[i] != lead) {
                registry.setRole(tokenId, members[i], registry.MEMBER());
            }
        }

        teamTable.insertIntoTable(
            tokenId,
            teamMetadata.name,
            teamMetadata.bio,
            teamMetadata.image,
            teamMetadata.twitter,
            teamMetadata.communications,
            teamMetadata.website,
            teamMetadata._view,
            teamMetadata.formId
        );

        projectTable.insertIntoTable(
            ProjectV2.ProjectData({
                id: projectMetadata.id,
                teamId: tokenId,
                name: projectMetadata.name,
                description: projectMetadata.description,
                image: projectMetadata.image,
                quarter: projectMetadata.quarter,
                year: projectMetadata.year,
                MDP: projectMetadata.MDP,
                proposalIPFS: projectMetadata.proposalIPFS,
                proposalLink: projectMetadata.proposalLink,
                upfrontPayments: projectMetadata.upfrontPayments,
                active: PROJECT_ACTIVE,
                eligible: 0
            })
        );
    }

    function constructSafeCallData(address[] memory signers) internal pure returns (bytes memory) {
        uint256 threshold = signers.length / 2 + 1;
        bytes memory proxyInitData = abi.encodeWithSelector(
            0xb63e800d,
            signers,
            threshold,
            address(0x0),
            new bytes(0),
            address(0xf48f2B2d2a534e402487b3ee7C18c33Aec0Fe5e4),
            address(0x0),
            0,
            address(0x0)
        );
        return proxyInitData;
    }
}
