// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseHook} from "v4-periphery/src/utils/BaseHook.sol";
import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";
import {OptionsBuilder} from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OptionsBuilder.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {Actions} from "v4-periphery/src/libraries/Actions.sol";
import { ILayerZeroEndpointV2, MessagingParams } from "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2.sol";
import {StateLibrary} from "v4-core/src/libraries/StateLibrary.sol";
import {IPositionManager} from "v4-periphery/src/interfaces/IPositionManager.sol";
import {PositionManager} from "v4-periphery/src/PositionManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {BalanceDelta } from "v4-core/src/types/BalanceDelta.sol";
import {CurrencyLibrary} from "v4-core/src/types/Currency.sol";
import { OApp, Origin, MessagingFee } from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function totalSupply() external view returns (uint256);
}

contract FeeHook is BaseHook, OApp, FunctionsClient{
    using PoolIdLibrary for PoolKey;
    using OptionsBuilder for bytes;
    using StateLibrary for IPoolManager;
    using FunctionsRequest for FunctionsRequest.Request;

    // State variables to store the last request ID, response, and error
    bytes32 public s_lastRequestId;
    bytes public s_lastResponse;
    bytes public s_lastError;
    string public character;
    uint32 gasLimit = 300000;
    bytes32 donID; // DON ID for Chainlink Functions
    // Event to log responses
    event Response(
        bytes32 indexed requestId,
        string character,
        bytes response,
        bytes err
    );
    error UnexpectedRequestID(bytes32 requestId);

    mapping(address => uint256) public totalWithdrawnPerUser;
    uint256 public totalWithdrawn;
    uint256 public totalReceived;
    bytes32[] public poolIds; // Pools owned by this contract at any point
    bytes32[] public transferredPoolIds; // Pools transferred to other addresses
    mapping(PoolId => uint256) public uncollectedFees; // Uncollected fees for each LP position
    mapping(PoolId => uint256) public TOKEN_ID; // Token ID for the NFT representing each LP position
    IPositionManager posm;
    uint256 public MIN_WITHDRAW = 0.01 ether;
    uint256 destinationChainId;
    uint16 destinationEid; // LayerZero endpoint ID
    address public vMooneyAddress;
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
        "["
        "'0x18160ddd', // totalSupply()"
        "`0x70a08231${usr.slice(2).padStart(64, '0')}`, // balanceOf(usr)"
        "].map((data, id) => ({"
        "jsonrpc: '2.0',"
        "id,"
        "method: 'eth_call',"
        "params: [{ to: addr, data }, 'latest'],"
        "}));"
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

    constructor(address owner, IPoolManager _poolManager, IPositionManager _posm, address _lzEndpoint, uint256 _destinationChainId, uint16 _destinationEid, address _vMooneyAddress, address _router, bytes32 _donID) BaseHook(_poolManager) OApp(_lzEndpoint, owner) Ownable(owner) FunctionsClient(_router) {
        posm = _posm;
        destinationChainId = _destinationChainId;
        destinationEid = _destinationEid;
        vMooneyAddress = _vMooneyAddress;
        donID = _donID;
    }

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: true,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: false,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: true,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    function sendCrossChain(
        bytes memory payload,
        bytes memory options,
        uint256 messageFee,
        address refundAddress
    ) external payable {
        _lzSend(
            destinationEid,
            payload,
            options,
            MessagingFee(messageFee, 0),
            payable(refundAddress)
        );
    }


    function _afterSwap(address, PoolKey calldata key, IPoolManager.SwapParams calldata _params, BalanceDelta, bytes calldata)
        internal
        override
        returns (bytes4, int128)
    {
        PoolId poolId = key.toId();
        if (_params.zeroForOne && _params.amountSpecified < 0) {
            uint256 feeAmount = uint256(-_params.amountSpecified) * uint256(key.fee) / 1e6;
            uncollectedFees[poolId] += feeAmount;
        }
        // Only withraw fees if the amount is above a certain threshold to save on gas
        if (uncollectedFees[poolId] >= MIN_WITHDRAW) {
            // 1. Collect fees.
            bytes memory actions = abi.encodePacked(uint8(Actions.DECREASE_LIQUIDITY), uint8(Actions.TAKE_PAIR));
            bytes[] memory params = new bytes[](2);
            uint256 tokenId = TOKEN_ID[poolId];
            params[0] = abi.encode(tokenId, 0, 0, 0, bytes(""));
            params[1] = abi.encode(key.currency0, key.currency1, address(this));
            posm.modifyLiquiditiesWithoutUnlock(
                actions, params
            );
            // Burn non-native tokens by sending them to the dEaD address
            if (CurrencyLibrary.balanceOfSelf(key.currency1) > 0) {
                CurrencyLibrary.transfer(key.currency1, address(0x000000000000000000000000000000000000dEaD), CurrencyLibrary.balanceOfSelf(key.currency1));
            }

            // 2. Transfer fees to this contract on the destination chain.
            if (block.chainid != destinationChainId) {
                bytes memory payload = abi.encode();
                // Determined empirically
                uint128 balance = uint128(address(this).balance);
                uint128 GAS_LIMIT = 500000;
                // Give an estimate slightly under what we expect
                uint128 messageFeeEstimate = 500_000_000_000_000;
                bytes memory optionsEstimate = OptionsBuilder.newOptions().addExecutorLzReceiveOption(GAS_LIMIT, balance - messageFeeEstimate);
                uint128 messageFee = uint128(ILayerZeroEndpointV2(endpoint).quote(
                    MessagingParams(destinationEid, peers[destinationEid][0], payload, optionsEstimate, false),
                    address(this)
                ).nativeFee);
                // Correct the message fee with the difference between the estimate and the quote
                bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(GAS_LIMIT, balance - messageFeeEstimate + balance - messageFee);
                // Note that external payable functions cannot be called directly
                // within a contract, so we have to instantiate a new instance
                // of the FeeHook contract to call the sendCrossChain function.
                FeeHook(payable(address(this))).sendCrossChain{value: balance}(
                    payload,
                    options,
                    balance,
                    address(this)
                );
            }
            uncollectedFees[poolId] = 0;

        }
        return (BaseHook.afterSwap.selector, 0);
    }

    function _beforeAddLiquidity(
        address,
        PoolKey calldata key,
        IPoolManager.ModifyLiquidityParams calldata,
        bytes calldata
    ) internal override returns (bytes4) {
        PoolId poolId = key.toId();
        if (TOKEN_ID[poolId] == 0) {
            TOKEN_ID[poolId] = posm.nextTokenId() - 1;
            poolIds.push(PoolId.unwrap(poolId));
        }
        return BaseHook.beforeAddLiquidity.selector;
    }

    // Allows the owner to transfer an LP position to another address
    // in case any manual intervention is needed.
    function transferPosition(
        address to,
        bytes32 poolId) external onlyOwner
    {
        PoolId id = PoolId.wrap(poolId);
        uint256 tokenId = TOKEN_ID[id];
        require(tokenId != 0, "Token ID not found");
        transferredPoolIds.push(poolId);
        PositionManager(payable(address(posm))).safeTransferFrom(address(this), to, tokenId, "");
    }


    function withdrawFees() external {
        uint256 withdrawable = getWithdrawableAmount();
        require(withdrawable > 0, "Nothing to withdraw");
        totalWithdrawnPerUser[msg.sender] += withdrawable;
        totalWithdrawn += withdrawable;
        transferETH(msg.sender, withdrawable);
    }

    /**
    * @notice Sends an HTTP request for character information
    * @param subscriptionId The ID for the Chainlink subscription
    * @param args The arguments to pass to the HTTP request
    * @return requestId The ID of the request
    */
    function sendRequest(
        uint64 subscriptionId,
        string[] calldata args
    ) external onlyOwner returns (bytes32 requestId) {
        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(source); // Initialize the request with JS code
        if (args.length > 0) req.setArgs(args); // Set the arguments for the request

        // Send the request and store the request ID
        s_lastRequestId = _sendRequest(
            req.encodeCBOR(),
            subscriptionId,
            gasLimit,
            donID
        );

        return s_lastRequestId;
    }

    /**
     * @notice Callback function for fulfilling a request
     * @param requestId The ID of the request to fulfill
     * @param response The HTTP response data
     * @param err Any errors from the Functions request
     */
    function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) internal override {
        if (s_lastRequestId != requestId) {
            revert UnexpectedRequestID(requestId); // Check if request IDs match
        }
        // Update the contract's state variables with the response and any errors
        s_lastResponse = response;
        character = string(response);
        s_lastError = err;

        // Emit an event to log the response
        emit Response(requestId, character, s_lastResponse, s_lastError);
    }

    function getWithdrawableAmount() public view returns (uint256) {
        if (block.chainid != destinationChainId) {
            revert("Not on destination chain. Cannot withdraw fees");
        }
        uint256 totalSupply = IERC20(vMooneyAddress).totalSupply();
        require(totalSupply > 0, "No vMooney supply");
        uint256 userBalance = IERC20(vMooneyAddress).balanceOf(msg.sender);
        uint256 userProportion = userBalance * 1e18 / totalSupply; // Multiply by 1e18 to preserve precision
        uint256 allocated = (userProportion * totalReceived) / 1e18; // Divide by 1e18 to normalize
        uint256 withdrawnByUser = totalWithdrawnPerUser[msg.sender];
        uint256 withdrawable = allocated - withdrawnByUser;
        return withdrawable;
    }

    function transferETH(address to, uint256 amount) internal {
        (bool success, ) = to.call{value: amount}("");
        require(success, "ETH transfer failed");
    }

    function setMinWithdraw(uint256 _minWithdraw) external onlyOwner {
        MIN_WITHDRAW = _minWithdraw;
    }

    function setvMooneyAddress(address _vMooneyAddress) external onlyOwner {
        vMooneyAddress = _vMooneyAddress;
    }

    receive() external payable {
        totalReceived += msg.value;
    }

    fallback() external payable {
        totalReceived += msg.value;
    }

    function _lzReceive(
        Origin calldata,
        bytes32,
        bytes calldata,
        address,
        bytes calldata
    ) internal override {
        totalReceived += msg.value;
    }

}
