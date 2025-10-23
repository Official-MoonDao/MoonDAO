// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";


contract FundingOracle is FunctionsClient, Ownable {
    mapping(uint256 => uint256) public missionIdToFunding;
    mapping(uint256 => mapping(uint256 => uint256)) public missionIdToChainIdToProjectId;
    uint256[] chainIds;

    mapping(bytes32 => uint256) public requestIdToMissionId;
    uint32 gasLimit = 300000;
    uint64 subscriptionId; // Chainlink subscription ID
    bytes32 donID; // DON ID for Chainlink Functions
    event FundingUpdate(
        bytes32 indexed requestId,
        uint256 totalFunding,
        uint256 missionId
    );
    string source =
        "const CHAINS = ['mainnet', 'arbitrum-mainnet', 'base-mainnet'];"
        "const JB_V5_MULTI_TERMINAL = '0x2dB6d704058E552DeFE415753465df8dF0361846';"
        "const JB_V5_TERMINAL_STORE = '0xfE33B439Ec53748C87DcEDACb83f05aDd5014744';"
        "const JB_NATIVE_TOKEN_ADDRESS = '0x000000000000000000000000000000000000EEEe';"
        "const u256ToBytes = (n) =>"
        "Array.from({ length: 32 }, (_, i) =>"
        "Number((n >> (8n * BigInt(31 - i))) & 0xffn)"
        ");"
        "const totalFunding = ("
        "await Promise.all("
        "CHAINS.map((chain, i) =>"
        "Functions.makeHttpRequest({"
        "url: `https://${chain}.infura.io/v3/357d367444db45688746488a06064e7c`,"
        "method: 'POST',"
        "data: {"
        "jsonrpc: '2.0',"
        "id: 0,"
        "method: 'eth_call',"
        "params: ["
        "{"
        "to: JB_V5_TERMINAL_STORE,"
        "data: `0x467f4cb9${JB_V5_MULTI_TERMINAL.slice(2).padStart("
        "64,"
        "'0'"
        ")}${args[i].slice(2)}${JB_NATIVE_TOKEN_ADDRESS.slice(2).padStart("
        "64,"
        "'0'"
        ")}`,"
        "},"
        "'latest',"
        "],"
        "},"
        "})"
        ")"
        ")"
        ").reduce((sum, r) => sum + BigInt(r.data.result || 0n), 0n);"
        "return new Uint8Array([...u256ToBytes(totalFunding)]);";

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

