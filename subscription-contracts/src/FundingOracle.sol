// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract FeeHook is FunctionsClient, Ownable {
    mapping(uint256 => uint256) public projectIdToFunding;
    uint256 public totalWithdrawn;
    uint256 public totalReceived;
    bytes32[] public poolIds; // Pools created with this hook
    bytes32[] public transferredPoolIds; // Pools transferred to other addresses
    mapping(PoolId => uint256) public uncollectedFees; // Uncollected fees for each LP position
    mapping(PoolId => uint256) public poolIdToTokenId; // Token ID for the NFT representing each LP position
    IPositionManager posm;
    uint256 public minWithdraw = 0.01 ether;
    uint256 destinationChainId;
    uint16 destinationEid; // LayerZero endpoint ID
    address public vMooneyAddress;

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

    constructor(address owner, IPoolManager _poolManager, IPositionManager _posm, address _lzEndpoint, uint256 _destinationChainId, uint16 _destinationEid, address _vMooneyAddress, address _router, bytes32 _donID, uint64 _subscriptionId) BaseHook(_poolManager) OApp(_lzEndpoint, owner) Ownable(owner) FunctionsClient(_router) {
        posm = _posm;
        destinationChainId = _destinationChainId;
        destinationEid = _destinationEid;
        vMooneyAddress = _vMooneyAddress;
        donID = _donID;
        subscriptionId = _subscriptionId;
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

    function setMinWithdraw(uint256 _minWithdraw) external onlyOwner {
        minWithdraw = _minWithdraw;
    }

    function setvMooneyAddress(address _vMooneyAddress) external onlyOwner {
        vMooneyAddress = _vMooneyAddress;
    }

    function setSource(string memory _source) external onlyOwner {
        source = _source;
    }

    function setSubscriptionId(uint64 _subscriptionId) external onlyOwner {
        subscriptionId = _subscriptionId;
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
        if (uncollectedFees[poolId] >= minWithdraw) {
            // 1. Collect fees.
            bytes memory actions = abi.encodePacked(uint8(Actions.DECREASE_LIQUIDITY), uint8(Actions.TAKE_PAIR));
            bytes[] memory params = new bytes[](2);
            uint256 tokenId = poolIdToTokenId[poolId];
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
        if (poolIdToTokenId[poolId] == 0) {
            poolIdToTokenId[poolId] = posm.nextTokenId() - 1;
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
        uint256 tokenId = poolIdToTokenId[id];
        require(tokenId != 0, "Token ID not found");
        transferredPoolIds.push(poolId);
        PositionManager(payable(address(posm))).safeTransferFrom(address(this), to, tokenId, "");
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
        require(totalSupply > 0, "Total supply is zero");
        require(userBalance > 0, "User balance is zero");
        uint256 userProportion = userBalance * 1e18 / totalSupply; // Multiply by 1e18 to preserve precision
        uint256 allocated = (userProportion * totalReceived) / 1e18; // Divide by 1e18 to normalize
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

    function transferETH(address to, uint256 amount) internal {
        (bool success, ) = to.call{value: amount}("");
        require(success, "ETH transfer failed");
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

