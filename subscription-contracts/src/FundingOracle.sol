// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";


contract FeeHook is FunctionsClient, Ownable {
    mapping(uint256 => uint256) public missionIdToFunding;
    mapping(uint256 => mapping(uint256 => uint256)) public missionIdToChainIdToProjectId;
    uint256[] chainIds;

    // Chainlink
    mapping(bytes32 => uint256) public requestIdToMissionId;
    uint32 gasLimit = 300000;
    uint64 subscriptionId; // Chainlink subscription ID
    bytes32 donID; // DON ID for Chainlink Functions
    // Event to log responses
    event FundingUpdate(
        bytes32 indexed requestId,
        uint256 totalFunding,
        uint256 missionId
    );
    string source =
        "const tokens = ["
        "{ chain: 'mainnet', address: '0xCc71C80d803381FD6Ee984FAff408f8501DB1740' },"
        "{"
        "chain: 'arbitrum-mainnet',"
        "address: '0xB255c74F8576f18357cE6184DA033c6d93C71899',"
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

    constructor(address owner, uint256[] _chainIds, address _router, bytes32 _donID, uint64 _subscriptionId) BaseHook(_poolManager) OApp(_lzEndpoint, owner) Ownable(owner) FunctionsClient(_router) {
        donID = _donID;
        subscriptionId = _subscriptionId;
        chainIds = _chainIds;
    }

    function setSource(string memory _source) external onlyOwner {
        source = _source;
    }

    function setSubscriptionId(uint64 _subscriptionId) external onlyOwner {
        subscriptionId = _subscriptionId;
    }

    function setProjectId(uint256 missionId, uint256 chainId, uint256 projectId) external onlyOwner{
        missionIdToChainIdToProjectId[missionId][chainId] = projectId;
    }

    function updateFunding(uint256 missionId) external returns (bytes32 requestId) {
        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(source);
        string[] memory args = new string[](chainIds.length);
        for (uint i = 0; i < chainIds.length; i++) {
            args[i] = missionIdToChainIdToProjectId[missionId][chainIds[i]].toHexString();
        }
        req.setArgs(args);
        requestId = _sendRequest(
            req.encodeCBOR(),
            subscriptionId,
            gasLimit,
            donID
        );
        requestIdToMissionId[requestId] = missionId;
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
            revert(string(err));
        }
        (uint256 totalFunding, uint256 missionId) = abi.decode(response, (uint256, uint256));
        address requestMissionId = requestIdToMissionId[requestId];
        require(missionId == requestMissionId, "Mission ID mismatch");
        missionIdToFunding[missionId] = totalFunding
        delete requestIdToMissionId[requestId];
        emit FundingUpdate(requestId, totalFunding, missionId);
    }
}

