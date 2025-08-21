// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@thirdweb-dev/contracts/extension/Ownable.sol";
import "@thirdweb-dev/contracts/eip/ERC721A.sol";
import "./IERC5643Team.sol";
import {ERC721URIStorage} from "./ERC721URIStorage.sol";
import "@thirdweb-dev/contracts/lib/Address.sol";
import "@hats/Interfaces/IHats.sol";
import "@evm-tableland/contracts/utils/URITemplate.sol";
import {Whitelist} from "./Whitelist.sol";

error RenewalTooShort();
error RenewalTooLong();
error InsufficientPayment();
error SubscriptionNotRenewable();
error InvalidTokenId();
error CallerNotOwnerNorApproved();

contract MoonDAOTeam is ERC721URIStorage, URITemplate, IERC5643Team, Ownable {

    // For example: targeted subscription = 0.5 eth / 365 days.
    // pricePerSecond = 5E17 wei / 31536000 (seconds in 365 days)

    // Roughly calculates to 0.5 (1E17 wei) ether per 365 days.
    uint256 public pricePerSecond = 15854895991;

    // Discount for renewal more than 12 dmonths. Denominator is 1000.
    uint256 public discount = 933;

    string private _baseURIString = "https://tableland.network/api/v1/query?unwrap=true&extract=true&statement=";

    mapping(uint256 => uint64) private _expirations;

    mapping(uint256 => uint256) public adminHatToTokenId;

    mapping(uint256 => uint256) public teamAdminHat;

    mapping(uint256 => uint256) public teamManagerHat;

    mapping(uint256 => uint256) public teamMemberHat;

    mapping(uint256 => address) public memberPassthroughModule;

    mapping(uint256 => address) public splitContract;

    address payable public moonDAOTreasury;
    address public moonDaoCreator;

    uint64 internal minimumRenewalDuration;
    uint64 internal maximumRenewalDuration;

    IHats internal hats;

    Whitelist private discountList;
    
    constructor(string memory name_, string memory symbol_, address _treasury, address _hats, address _discountList)
        ERC721A(name_, symbol_) 
    {
        _setupOwner(_msgSender());
        moonDAOTreasury = payable(_treasury);
        hats = IHats(_hats);
        discountList = Whitelist(_discountList);
    }

    function setDiscountList(address _discountList) public onlyOwner {
        discountList = Whitelist(_discountList);
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

    function setTreasury(address _newTreasury) public onlyOwner {
        moonDAOTreasury = payable(_newTreasury);
    }

    function mintTo(address to, address sender, uint256 adminHat, uint256 managerHat, uint256 memberHat, address _memberPassthroughModule, address _splitContract) external payable returns (uint256) {
        require (msg.sender == moonDaoCreator, "Only the MoonDAO Team Creator can mint");

        uint256 tokenId = _currentIndex;

        _mint(to, 1);
        renewSubscription(sender, tokenId, 365 days);

        teamAdminHat[tokenId] = adminHat;
        adminHatToTokenId[adminHat] = tokenId;
        teamManagerHat[tokenId] = managerHat;
        teamMemberHat[tokenId] = memberHat;

        memberPassthroughModule[tokenId] = _memberPassthroughModule;

        splitContract[tokenId] = _splitContract;

        return tokenId;
    }


    /**
     * Allow owner to change the subscription price
     * @param _pricePerSecond new pricePerSecond
     */
    function setPricePerSecond(uint256 _pricePerSecond) external onlyOwner {
        pricePerSecond = _pricePerSecond;
    }


    /**
     * Allow owner to change the discount
     * @param _discount new discount
     */

    function setDiscount(uint256 _discount) external onlyOwner {
        discount = _discount;
    }

    /**
     * Allow owner to change the moonDaoCreator
     * @param _moonDaoCreator new moonDaoCreator
     */

    function setMoonDaoCreator(address _moonDaoCreator) external onlyOwner {
        moonDaoCreator = _moonDaoCreator;
    }


    /**
     * @dev See {IERC5643Team-renewSubscription}.
     */
    function renewSubscription(address sender, uint256 tokenId, uint64 duration)
        public
        payable
        virtual
    {
        // if (!_isApprovedOrOwner(msg.sender, tokenId)) {
        //     revert CallerNotOwnerNorApproved();
        // }

        if (duration < minimumRenewalDuration) {
            revert RenewalTooShort();
        } else if (
            maximumRenewalDuration != 0 && duration > maximumRenewalDuration
        ) {
            revert RenewalTooLong();
        }

        if (msg.value < getRenewalPrice(sender, duration)) {
            revert InsufficientPayment();
        }

        moonDAOTreasury.call{value: msg.value}("");
        
        _extendSubscription(tokenId, duration);
    }

    function setMinimumRenewalDuration(uint64 duration) external onlyOwner {
        _setMinimumRenewalDuration(duration);
    }

    function setMaximumRenewalDuration(uint64 duration) external onlyOwner {
        _setMaximumRenewalDuration(duration);
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
     * @dev Extends the subscription for `tokenId` for `duration` seconds.
     * If the `tokenId` does not exist, an error will be thrown.
     * If a token is not renewable, an error will be thrown.
     * Emits a {SubscriptionUpdate} event after the subscription is extended.
     */
    function _extendSubscription(uint256 tokenId, uint64 duration)
        internal
        virtual
    {
        if (!_exists(tokenId)) {
            revert InvalidTokenId();
        }

        uint64 currentExpiration = _expirations[tokenId];
        uint64 newExpiration;
        if ((currentExpiration == 0) || (currentExpiration < block.timestamp)) {
            newExpiration = uint64(block.timestamp) + duration;
        } else {
            if (!_isRenewable(tokenId)) {
                revert SubscriptionNotRenewable();
            }
            newExpiration = currentExpiration + duration;
        }

        _expirations[tokenId] = newExpiration;

        emit SubscriptionUpdate(tokenId, newExpiration);
    }

    /**
     * @dev Gets the price to renew a subscription for `duration` seconds for
     * a given tokenId. This value is defaulted to 0, but should be overridden in
     * implementing contracts.
     */
    function getRenewalPrice(address owner, uint64 duration) public view virtual returns (uint256) {
        uint256 price = duration * pricePerSecond;
        return discountList.isWhitelisted(owner) ? price * (1000 - discount) / 1000 : price;
    }

    /**
     * @dev See {IERC5643Team-cancelSubscription}.
     */
    function cancelSubscription(uint256 tokenId) external payable virtual {
        if (!(_isApprovedOrOwner(msg.sender, tokenId) || _msgSender() == owner())) {
            revert CallerNotOwnerNorApproved();
        }

        delete _expirations[tokenId];

        emit SubscriptionUpdate(tokenId, 0);
    }

    /**
     * @dev See {IERC5643Team-expiresAt}.
     */
    function expiresAt(uint256 tokenId)
        external
        view
        virtual
        returns (uint64)
    {
        if (!_exists(tokenId)) {
            revert InvalidTokenId();
        }
        return _expirations[tokenId];
    }

    /**
     * @dev See {IERC5643Team-isRenewable}.
     */
    function isRenewable(uint256 tokenId)
        external
        view
        virtual
        returns (bool)
    {
        if (!_exists(tokenId)) {
            revert InvalidTokenId();
        }
        return _isRenewable(tokenId);
    }

    /**
     * @dev Internal function to determine renewability. Implementing contracts
     * should override this function if renewabilty should be disabled for all or
     * some tokens.
     */
    function _isRenewable(uint256 tokenId)
        internal
        view
        virtual
        returns (bool)
    {
        return true;
    }

    /**
     * @dev Internal function to set the minimum renewal duration.
     */
    function _setMinimumRenewalDuration(uint64 duration) internal virtual {
        minimumRenewalDuration = duration;
    }

    /**
     * @dev Internal function to set the maximum renewal duration.
     */
    function _setMaximumRenewalDuration(uint64 duration) internal virtual {
        maximumRenewalDuration = duration;
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


    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override
        returns (bool)
    {
        return interfaceId == type(IERC5643Team).interfaceId
            || super.supportsInterface(interfaceId);
    }
}
