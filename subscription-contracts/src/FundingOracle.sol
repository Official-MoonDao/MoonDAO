// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract FeeHook is FunctionsClient, Ownable {
    mapping(uint256 => uint256) public projectIdToFunding;

    // Chainlink
    mapping(bytes32 => address) public requestIdToSender;
    uint32 gasLimit = 300000;
    uint64 subscriptionId; // Chainlink subscription ID
    bytes32 donID; // DON ID for Chainlink Functions
    // Event to log responses
    event Withdraw(
        bytes32 indexed requestId,
        uint256 totalSupply,
        uint256 userBalance,
        address user,
        uint256 withdrawAmount
    );
    string source =
        "const tokens = ["
        "{ chain: 'mainnet', address: '0xCc71C80d803381FD6Ee984FAff408f8501DB1740' },"
        "{"
        "chain: 'arbitrum-mainnet',"
        "address: '0xB255c74F8576f18357cE6184DA033c6d93C71899',"
        "},"
        "{"
        "chain: 'polygon-mainnet',"
        "address: '0xe2d1BFef0A642B717d294711356b468ccE68BEa6',"
        "},"
        "{"
        "chain: 'base-mainnet',"
        "address: '0x7f8f1B45c3FD6Be4F467520Fc1Cf030d5CaBAcF5',"
        "},"
        "];"
        "const u256ToBytes = (n) =>"
        "Array.from({ length: 32 }, (_, i) =>"
        "Number((n >> (8n * BigInt(31 - i))) & 0xffn)"
        ");"
        "const buildCalls = (addr, usr) =>"
        "['0x18160ddd', `0x70a08231${usr.slice(2).padStart(64, '0')}`].map("
        "(data, id) => ({"
        "jsonrpc: '2.0',"
        "id,"
        "method: 'eth_call',"
        "params: [{ to: addr, data }, 'latest'],"
        "})"
        ");"
        "const responses = await Promise.all("
        "tokens.map((t) =>"
        "Functions.makeHttpRequest({"
        "url: `https://${t.chain}.infura.io/v3/357d367444db45688746488a06064e7c`,"
        "method: 'POST',"
        "data: buildCalls(t.address, args[0]),"
        "})"
        ")"
        ");"
        "const [totalSupplySum, balanceSum] = [0, 1].map((callIdx) =>"
        "responses.reduce((sum, r) => sum + BigInt(r.data[callIdx].result || 0n), 0n)"
        ");"
        "return new Uint8Array(["
        "...u256ToBytes(totalSupplySum),"
        "...u256ToBytes(balanceSum),"
        "]);";

    constructor(address owner, address _router, bytes32 _donID, uint64 _subscriptionId) BaseHook(_poolManager) OApp(_lzEndpoint, owner) Ownable(owner) FunctionsClient(_router) {
        donID = _donID;
        subscriptionId = _subscriptionId;
    }

    function setSource(string memory _source) external onlyOwner {
        source = _source;
    }

    function setSubscriptionId(uint64 _subscriptionId) external onlyOwner {
        subscriptionId = _subscriptionId;
    }

    /**
    * @notice Sends a request to withdraw fees, to be fulfilled by chainlink's decentralized oracle network
    * @return requestId The ID of the request
    */
    function withdrawFees() external returns (bytes32 requestId) {
        if (block.chainid != destinationChainId) {
            revert("Withdraw: not on destination chain");
        }
        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(source); // Initialize the request with JS code
        string memory addressString = uint256(uint160(msg.sender)).toHexString(20);
        string[] memory args = new string[](1);
        args[0] = addressString; // Set the address argument
        req.setArgs(args); // Set the arguments for the request

        // Send the request and store the request ID
        requestId = _sendRequest(
            req.encodeCBOR(),
            subscriptionId,
            gasLimit,
            donID
        );
        requestIdToSender[requestId] = msg.sender;

        return requestId;
    }

    /**
     * @notice Callback function for fulfilling a request to withdrawFees
     * @param requestId The ID of the request to fulfill
     * @param response The HTTP response data
     * @param err Any errors from the Functions request
     */
    function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) internal override {
        if (err.length > 0) {
            revert(string(err));  // bubble up the actual error
        }
        // Update the contract's state variables with the response and any errors
        (uint256 totalSupply, uint256 userBalance) = abi.decode(response, (uint256, uint256));
        address withdrawAddress = requestIdToSender[requestId];
        require(withdrawAddress != address(0), "Unknown requestId");
        uint256 withdrawnByUser = totalWithdrawnPerUser[withdrawAddress];
        uint256 withdrawAmount = allocated - withdrawnByUser;
        require(withdrawAmount > 0, "Nothing to withdraw");
        totalWithdrawnPerUser[withdrawAddress] += withdrawAmount;
        totalWithdrawn += withdrawAmount;
        transferETH(withdrawAddress, withdrawAmount);
        delete requestIdToSender[requestId];

        // Emit an event to log the response
        emit Withdraw(requestId, totalSupply, userBalance, withdrawAddress, withdrawAmount);
    }
}

