/*
    NAME: TICKET-TO-SPACE-2
    CHAIN: MAINNET
*/

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;    

import "@thirdweb-dev/contracts/eip/ERC721A.sol";
import "@thirdweb-dev/contracts/extension/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@chainlink/contracts/src/v0.8/interfaces/LinkTokenInterface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract TicketToSpace2 is ERC721A, Ownable, VRFConsumerBaseV2 {
    VRFCoordinatorV2Interface COORDINATOR;
    LinkTokenInterface immutable LINKTOKEN =
        LinkTokenInterface(0x326C977E6efc84E512bB9C30f76E30c160eD06FB); //https://vrf.chain.link/mainnet
    bytes32 immutable keyHash =
        0x4b09e658ed251bcafeebbc69400383d49f344ace09b9576fe248bb02c003fe9f; //200gwei mainnet
    address immutable vrfCoordinator_ = 0x7a1BaC17Ccc5b313516C5E16fb24f7659aA5ebed;

   struct RequestStatus {
        bool paid; // paid?
        bool fulfilled; // whether the request has been successfully fulfilled
        uint256[] randomWords; 
    }
    
    mapping(uint256 => RequestStatus)
        public s_requests; /* requestId --> requestStatus */

    mapping(uint256 => address)  
        public winners;

    uint256 public winnersCount = 5;

    string private _nftName = "Ticket to Space NFT 2";
    string private _image = "ipfs://Qmba3umb3db7DqCA19iRSSbtzv9nYUmP8Cibo5QMkLpgpP";

    IERC20 public mooneyToken = IERC20(0x3818f3273D1f46259b737342Ad30e576A7A74f09);
    uint256 public mintPrice = 100 * 10 ** 18;

    bytes32 public previousEntrantsMerkleRoot;

    //VRF subscription ID.
    uint64 s_subscriptionId;

    uint256[] public requestIds;
    uint256 public lastRequestId;

    uint16 immutable requestConfirmations = 6;
    uint32 immutable numWords = 1;
    uint256 public immutable maxTokens = 2**256 - 1;
    uint256 public immutable maxWalletMints = 50;

    bool public allowTransfers = false;
    bool public allowMinting = false;
    
    bool internal locked; //re-entry lock

    //EVENTS
    event RequestSent(uint256 requestId, uint32 numWords);
    event RequestFulfilled(uint256 requestId, uint256[] randomWords);
    event WinnerSelected(uint256 winnerNum, address winner);

    constructor() VRFConsumerBaseV2(0x7a1BaC17Ccc5b313516C5E16fb24f7659aA5ebed) ERC721A("Ticket to Space 2", "TTS2") {
          COORDINATOR = VRFCoordinatorV2Interface(vrfCoordinator_);
          _setupOwner(msg.sender);
    }

    //MODIFIERS
    modifier reEntrancyGuard(){ 
        require(!locked, "No re-entrancy");
        locked = true;
        _;
        locked = false;
    }

    //FUNCTIONS
    function _canSetOwner() internal view virtual override  returns (bool) {
        return msg.sender == owner();
    }

    function setImage(string memory image) public onlyOwner {
        _image = image;
    }

    function setSubscript(uint64 subscriptionId_) external onlyOwner {
        s_subscriptionId = subscriptionId_;
    }

    function setAllowTransfers(bool allowTransfers_) external onlyOwner {
        allowTransfers = allowTransfers_;
    }

    function setAllowMinting(bool allowMinting_) external onlyOwner {
        allowMinting = allowMinting_;
    }

    function setMooneyToken(IERC20 mooneyToken_) external onlyOwner {
        mooneyToken = mooneyToken_;
    }

    function setMintPrice(uint256 mintPrice_) external onlyOwner {
        mintPrice = mintPrice_;
    }

    function addMerkleRoot(bytes32 _merkleRoot) external onlyOwner {
        previousEntrantsMerkleRoot = _merkleRoot;
    }

    function toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
  
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory){
        require(_exists(tokenId), "URI query for nonexistent token");
        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{"name": "',
                        _nftName,
                        " #",
                        toString(tokenId),
                        '", "image": "',
                        _image,
                        '"}'
                    )
                )
            )
        );
        return string(abi.encodePacked("data:application/json;base64,", json));
    }

    function getSupply() public view returns (uint256) {
        return _currentIndex;
    }

    function canClaimFree(bytes32[] calldata merkleProof, address receiver)
        public
        view
        returns (bool)
    {

        return
            MerkleProof.verify(
                merkleProof,
                previousEntrantsMerkleRoot,
                keccak256(abi.encodePacked(receiver))
            ) && balanceOf(receiver) == 0;
    }

    function claimFree(bytes32[] calldata merkleProof) public {
        require(allowMinting, "Minting is not currently open");
        require(_currentIndex < maxTokens, "error:10003 NFT mint limit reached");
        require(balanceOf(msg.sender) < maxWalletMints, "Address has already minted the maximum amount of NFTs");

        address claimAddress = msg.sender;
        require(canClaimFree(merkleProof, claimAddress), "Address cannot claim for free, or has already claimed");
        _safeMint(claimAddress, 1);
    }

    function mint(uint256 count) public payable {
        require(allowMinting, "Minting is not currently open");
        require(_currentIndex + count < maxTokens, "Tickets already minted");
        require(count + balanceOf(msg.sender) <= maxWalletMints, "Mint amount is more than allowed");

        mooneyToken.transferFrom(msg.sender, address(0x000000000000000000000000000000000000dEaD), mintPrice*count);
        _safeMint(msg.sender, count);
    }

    function _beforeTokenTransfers(address from, address to, uint256 tokenId, uint256 batchSize)
        internal
        override
    {  
        super._beforeTokenTransfers(from, to, tokenId, batchSize);
        //non-transferable after mint until allowTransfers = true
        if(from != address(0x0) && !allowTransfers) revert("Transfers disabled");
    }

    function chooseWinner(uint32 limit) external onlyOwner returns(uint256 requestId) {
        uint32 callbackGasLimit = limit;
        requestId = COORDINATOR.requestRandomWords(
            keyHash,
            s_subscriptionId,
            requestConfirmations,
            callbackGasLimit,
            numWords
        );
        s_requests[requestId] = RequestStatus({
            randomWords: new uint256[](0),
            paid: true,
            fulfilled: false
        });
        requestIds.push(requestId);
        lastRequestId = requestId;
        emit RequestSent(requestId, numWords);
        return requestId;
    }

     function fulfillRandomWords(uint256 _requestId, uint256[] memory _randomWords)
        internal
        override
    {
        require(s_requests[_requestId].paid, "request not found");
        s_requests[_requestId].fulfilled = true;
        s_requests[_requestId].randomWords = _randomWords;
        addWinner(this.ownerOf(_randomWords[0] % _currentIndex));
        emit RequestFulfilled(_requestId, _randomWords);
    }

     function getRequestStatus(
        uint256 _requestId
    )
        external
        view
        returns (bool paid, bool fulfilled, uint256[] memory randomWords)
    {
        RequestStatus memory request = s_requests[_requestId];
        return (request.paid, request.fulfilled, request.randomWords);
    }

    function addWinner(address winner) internal {
        require(winnersCount > 0, "All winners already chosen");
        winners[winnersCount] = winner;
        winnersCount -= 1;
        emit WinnerSelected(winnersCount, winner);
    }
}
