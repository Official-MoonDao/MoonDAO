// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {MoonDAOTeam} from "./ERC5643.sol";
import {TeamMinterRouter} from "./TeamMinterRouter.sol";
import {TeamRoleRegistry} from "./TeamRoleRegistry.sol";
import "./GnosisSafeProxyFactory.sol";
import "./GnosisSafeProxy.sol";
import {MoonDaoTeamTableland} from "./tables/MoonDaoTeamTableland.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Whitelist} from "./Whitelist.sol";
import {PaymentSplitter} from "./PaymentSplitter.sol";

/**
 * @title MoonDAOTeamCreatorV2
 * @notice Hats-free replacement for MoonDAOTeamCreator. Deploys a Gnosis Safe and a payment
 *         splitter, mints a MoonDAOTeam NFT via the TeamMinterRouter, and records roles in the
 *         TeamRoleRegistry (creator = MANAGER, members = MEMBER) instead of building a hats tree.
 */
contract MoonDAOTeamCreatorV2 is Ownable {
    MoonDAOTeam internal moonDAOTeam;
    TeamMinterRouter internal minter;
    TeamRoleRegistry internal registry;

    address internal gnosisSingleton;
    GnosisSafeProxyFactory internal gnosisSafeProxyFactory;

    MoonDaoTeamTableland public table;
    Whitelist internal whitelist;

    bool public openAccess;

    mapping(address => bool) public authorizedSigners;

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

    constructor(
        address _moonDAOTeam,
        address _minter,
        address _registry,
        address _gnosisSingleton,
        address _gnosisSafeProxyFactory,
        address _table,
        address _whitelist,
        address[] memory _authorizedSigners
    ) Ownable(msg.sender) {
        moonDAOTeam = MoonDAOTeam(_moonDAOTeam);
        minter = TeamMinterRouter(_minter);
        registry = TeamRoleRegistry(_registry);
        gnosisSingleton = _gnosisSingleton;
        gnosisSafeProxyFactory = GnosisSafeProxyFactory(_gnosisSafeProxyFactory);
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

    function setMoonDaoTeamTable(address _table) external onlyOwner {
        table = MoonDaoTeamTableland(_table);
    }

    function setWhitelist(address _whitelist) external onlyOwner {
        whitelist = Whitelist(_whitelist);
    }

    function setOpenAccess(bool _openAccess) external onlyOwner {
        openAccess = _openAccess;
    }

    function createMoonDAOTeamFor(
        address creator,
        TeamMetadata calldata metadata,
        address[] memory members
    ) external payable onlyAuthorizedSigner returns (uint256 tokenId) {
        return _createMoonDAOTeam(creator, metadata, members);
    }

    function createMoonDAOTeam(
        TeamMetadata calldata metadata,
        address[] memory members
    ) external payable returns (uint256 tokenId) {
        return _createMoonDAOTeam(msg.sender, metadata, members);
    }

    function _createMoonDAOTeam(
        address creator,
        TeamMetadata calldata metadata,
        address[] memory members
    ) internal returns (uint256 tokenId) {
        require(whitelist.isWhitelisted(creator) || openAccess, "Only whitelisted addresses can create a MoonDAO Team");

        bytes memory safeCallData = constructSafeCallData(creator, members);
        GnosisSafeProxy gnosisSafe = gnosisSafeProxyFactory.createProxy(gnosisSingleton, safeCallData);

        address[] memory payees = new address[](2);
        payees[0] = address(gnosisSafe);
        payees[1] = creator;
        uint256[] memory shares = new uint256[](2);
        shares[0] = 9900;
        shares[1] = 100;
        PaymentSplitter split = new PaymentSplitter(payees, shares);

        tokenId = minter.mintTo{value: msg.value}(
            address(gnosisSafe),
            creator,
            0,
            0,
            0,
            address(0),
            address(split)
        );

        registry.setRegistryBased(tokenId, true);
        registry.setRole(tokenId, creator, registry.MANAGER());
        for (uint256 i = 0; i < members.length; i++) {
            if (members[i] != creator) {
                registry.setRole(tokenId, members[i], registry.MEMBER());
            }
        }

        table.insertIntoTable(
            tokenId,
            metadata.name,
            metadata.bio,
            metadata.image,
            metadata.twitter,
            metadata.communications,
            metadata.website,
            metadata._view,
            metadata.formId
        );
    }

    function constructSafeCallData(address caller, address[] memory members) internal pure returns (bytes memory) {
        uint256 maxOwners = 5;
        uint256 ownersLength = members.length + 1 > maxOwners ? maxOwners : members.length + 1;
        address[] memory owners = new address[](ownersLength);
        owners[0] = caller;
        for (uint256 i = 1; i < ownersLength; i++) {
            owners[i] = members[i - 1];
        }
        uint256 threshold = owners.length / 2 + 1;
        bytes memory proxyInitData = abi.encodeWithSelector(
            0xb63e800d,
            owners,
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
