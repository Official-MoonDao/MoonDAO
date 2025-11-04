// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@thirdweb-dev/contracts/extension/Ownable.sol";
import "@thirdweb-dev/contracts/eip/ERC721A.sol";
import "./IERC5643.sol";
import {ERC721URIStorage} from "./ERC721URIStorage.sol";
import "@thirdweb-dev/contracts/lib/Address.sol";
import "@evm-tableland/contracts/utils/URITemplate.sol";
import {MoonDaoCitizenTableland} from "./tables/MoonDaoTableland.sol";
import {Whitelist} from "./Whitelist.sol";

error RenewalTooShort();
error RenewalTooLong();
error InsufficientPayment();
error SubscriptionNotRenewable();
error InvalidTokenId();
error CallerNotOwnerNorApproved();

contract MoonDAOCitizen is ERC721URIStorage, URITemplate, IERC5643, Ownable {

    // For example: targeted subscription = 0.5 eth / 365 days.
    // pricePerSecond = 5E17 wei / 31536000 (seconds in 365 days)

    // Roughly calculates to 0.1 (1E17 wei) ether per 365 days.
    uint256 public pricePerSecond = 351978691;


    uint256 public discount = 1000;

    string private _baseURIString = "https://tableland.network/api/v1/query?unwrap=true&extract=true&statement=";

    mapping(uint256 => uint64) private _expirations;

    address payable public moonDAOTreasury;

    uint64 internal minimumRenewalDuration;
    uint64 internal maximumRenewalDuration;

    MoonDaoCitizenTableland public table;

    bool public openAccess = false;

    Whitelist private whitelist;

    Whitelist private discountList;

    mapping(address => uint256) private owns;



    
    constructor(string memory name_, string memory symbol_, address _treasury, address _table, address _whitelist, address _discountList)
        ERC721A(name_, symbol_) 
    {
        _setupOwner(_msgSender());
        moonDAOTreasury = payable(_treasury);
        table = MoonDaoCitizenTableland(_table);
        whitelist = Whitelist(_whitelist);
        discountList = Whitelist(_discountList);

        string memory uriTemplate = string.concat("SELECT+json_object%28%27id%27%2C+id%2C+%27name%27%2C+name%2C+%27description%27%2C+description%2C+%27image%27%2C+image%2C+%27attributes%27%2C+json_array%28json_object%28%27trait_type%27%2C+%27location%27%2C+%27value%27%2C+location%29%2C+json_object%28%27trait_type%27%2C+%27discord%27%2C+%27value%27%2C+discord%29%2C+json_object%28%27trait_type%27%2C+%27twitter%27%2C+%27value%27%2C+twitter%29%2C+json_object%28%27trait_type%27%2C+%27website%27%2C+%27value%27%2C+website%29%2C+json_object%28%27trait_type%27%2C+%27view%27%2C+%27value%27%2C+view%29%2C+json_object%28%27trait_type%27%2C+%27formId%27%2C+%27value%27%2C+formId%29%29%29+FROM+", table.getTableName(), "+WHERE+id%3D");
		setURITemplate(uriTemplate);
    }

    function setWhitelist(address _whitelist) public onlyOwner {
        whitelist = Whitelist(_whitelist);
    }

    function setDiscountList(address _discountList) public onlyOwner {
        discountList = Whitelist(_discountList);
    }

    function setOpenAccess(bool _openAccess) public onlyOwner {
        openAccess = _openAccess;
    }

    function getOwnedToken(address _owner) public view returns (uint256) {
        if (balanceOf(_owner) == 0) {
            revert("No token owned");
        }
        return owns[_owner];
    }

    function setTable(address _table) public onlyOwner {
        table = MoonDaoCitizenTableland(_table);
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

    function mintTo(address to, string memory name, string memory bio, string memory image, string memory location, string memory discord, string memory twitter, string memory website, string memory _view, string memory formId) external payable returns (uint256) {

        if (!openAccess) {
            require(whitelist.isWhitelisted(msg.sender), "Caller is not whitelisted");
        }

        uint256 tokenId = _currentIndex;

        _mint(to, 1);
        renewSubscription(tokenId, 365 days);

        table.insertIntoTable(tokenId, name, bio, image, location, discord, twitter, website, _view, formId, to);

        return tokenId;
    }

    function recoverMintTo(address to) public onlyOwner returns (uint256) {
        uint256 tokenId = _currentIndex;
        _mint(to, 1);
        renewSubscription(tokenId, 365 days);
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
     * @dev See {IERC5643-renewSubscription}.
     */
    function renewSubscription(uint256 tokenId, uint64 duration)
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

        if (msg.value < _getRenewalPrice(tokenId, duration)) {
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
    function _getRenewalPrice(uint256 tokenId, uint64 duration)
        internal
        view
        virtual
        returns (uint256)
    {
        uint256 price = duration * pricePerSecond;
        address owner = this.ownerOf(tokenId);
        return discountList.isWhitelisted(owner) ? price * (1000 - discount) / 1000  : price;
    }

    function getRenewalPrice(address owner, uint64 duration) public view returns (uint256) {
        uint256 price = duration * pricePerSecond;
        return discountList.isWhitelisted(owner) ? price * (1000 - discount) / 1000  : price;
    }

    /**
     * @dev See {IERC5643-cancelSubscription}.
     */
    function cancelSubscription(uint256 tokenId) external payable virtual {
        if (!_isApprovedOrOwner(msg.sender, tokenId) || _msgSender() == owner()) {
            revert CallerNotOwnerNorApproved();
        }

        delete _expirations[tokenId];

        emit SubscriptionUpdate(tokenId, 0);
    }

    /**
     * @dev See {IERC5643-expiresAt}.
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
     * @dev See {IERC5643-isRenewable}.
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
        require(quantity == 1, "Only one token may be transferred at a time!");
        require (from == address(0) || to == address(0), "You may not transfer your token!");
        require (balanceOf(to) == 0, "Each address may only hold one token!");
    }

    function _afterTokenTransfers(address from, address to, uint256 startTokenId, uint256 quantity) internal virtual override {
        if (from == address(0)) {
            owns[to] = startTokenId;
            return;
        }
        table.updateTableCol("owner", Strings.toHexString(to), from);
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
        return interfaceId == type(IERC5643).interfaceId
            || super.supportsInterface(interfaceId);
    }
}
