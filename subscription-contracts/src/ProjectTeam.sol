// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@thirdweb-dev/contracts/extension/Ownable.sol";
import "@thirdweb-dev/contracts/eip/ERC721A.sol";
import {ERC721URIStorage} from "./ERC721URIStorage.sol";
import "@thirdweb-dev/contracts/lib/Address.sol";
import "@hats/Interfaces/IHats.sol";
import "@evm-tableland/contracts/utils/URITemplate.sol";

error InsufficientPayment();
error InvalidTokenId();
error CallerNotOwnerNorApproved();

contract ProjectTeam is ERC721URIStorage, URITemplate, Ownable {

    string private _baseURIString = "https://tableland.network/api/v1/query?unwrap=true&extract=true&statement=";

    mapping(uint256 => uint256) public adminHatToTokenId;

    mapping(uint256 => uint256) public teamAdminHat;

    mapping(uint256 => uint256) public teamManagerHat;

    mapping(uint256 => uint256) public teamMemberHat;

    mapping(uint256 => address) public memberPassthroughModule;

    mapping(uint256 => address) public projectLead;

    address public projectTeamCreator;

    IHats internal hats;

    
    constructor(string memory name_, string memory symbol_, address _treasury, address _hats)
        ERC721A(name_, symbol_) 
    {
        _setupOwner(_msgSender());
        hats = IHats(_hats);
    }


    function _baseURI() internal view override returns (string memory) {
        return _baseURIString;
    }

    // Ensures the contract owner can easily update the project's baseURI
    function setBaseURI(string memory baseURI) public onlyOwner {
        _baseURIString = baseURI;
    }

    // method to set our uriTemplate
    function setURITemplate(string memory uriTemplate)
        public
        onlyOwner
    {
        // create a size 1 array
        string[] memory uriTemplates = new string[](1);
        // set the first element to the uriTemplate
        uriTemplates[0] = uriTemplate;
        _setURITemplate(uriTemplates);
    }
    
    // public method to read the tokenURI
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721URIStorage)
        returns (string memory)
    {
        if (!_exists(tokenId)) revert URIQueryForNonexistentToken();
        string memory baseURI = _baseURI();
        string memory _tokenURI = _getTokenURI(Strings.toString(tokenId));
        return bytes(baseURI).length != 0 ? string(abi.encodePacked(baseURI, _tokenURI)) : "";
    }

    function mintTo(address to, address sender, uint256 adminHat, uint256 managerHat, uint256 memberHat, address _memberPassthroughModule) external returns (uint256) {
        require (msg.sender == projectTeamCreator, "Only the Project Team Creator can mint");

        uint256 tokenId = _currentIndex;

        _mint(to, 1);

        teamAdminHat[tokenId] = adminHat;
        adminHatToTokenId[adminHat] = tokenId;
        teamManagerHat[tokenId] = managerHat;
        teamMemberHat[tokenId] = memberHat;

        memberPassthroughModule[tokenId] = _memberPassthroughModule;


        return tokenId;
    }



    /**
     * Allow owner to change the projectTeamCreator
     * @param _projectTeamCreator new projectTeamCreator
     */

    function setProjectTeamCreator(address _projectTeamCreator) external onlyOwner {
        projectTeamCreator = _projectTeamCreator;
    }


    function isManager(uint256 tokenId, address sender) external view returns (bool) {
        if (!_exists(tokenId)) {
            revert InvalidTokenId();
        }

        require(hats.isWearerOfHat(sender, teamManagerHat[tokenId]), "must wear ManagerHat");

        uint32 managerHatLevel = hats.getLocalHatLevel(teamManagerHat[tokenId]);
        uint256 adminOfManagerHat = hats.getAdminAtLevel(teamManagerHat[tokenId], managerHatLevel - 1);

        require(adminOfManagerHat == teamAdminHat[tokenId], "ManagerHat must be a child of AdminHat");

        return true;
    } 

 
    /**
     *  This function returns who is authorized to set the owner of your contract.
     *  Only allow the current owner to set the contract's new owner.
     */
    function _canSetOwner() internal virtual view override returns (bool) {
        return msg.sender == owner();
    }

    /**
     * @dev Returns whether `spender` is allowed to manage `tokenId`.
     *
     * Requirements:
     *
     * - `tokenId` must exist.
     */
    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view virtual returns (bool) {
        address owner = this.ownerOf(tokenId);
        return (spender == owner || isApprovedForAll(owner, spender) || getApproved(tokenId) == spender);
    }

    // Disable token transfers
    function _beforeTokenTransfers(address from, address to, uint256 startTokenId, uint256 quantity) internal virtual override {
        require (from == address(0) || to == address(0), "You may not transfer your token!");
    }
}
