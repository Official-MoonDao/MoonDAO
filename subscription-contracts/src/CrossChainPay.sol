// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { Origin, MessagingFee } from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

// Stargate v2 interfaces
interface IStargate {
    struct SendParam {
        uint32 dstEid;
        bytes32 to;
        uint256 amountLD;
        uint256 minAmountLD;
        bytes extraOptions;
        bytes composeMsg;
        bytes oftCmd;
    }

    struct MessagingFee {
        uint256 nativeFee;
        uint256 lzTokenFee;
    }

    function send(
        SendParam calldata _sendParam,
        MessagingFee calldata _fee,
        address _refundTo
    ) external payable returns (MessagingReceipt memory msgReceipt);

    function quoteSend(
        SendParam calldata _sendParam,
        bool _payInLzToken
    ) external view returns (MessagingFee memory msgFee);
}

struct MessagingReceipt {
    bytes32 guid;
    uint64 nonce;
    MessagingFee fee;
}

interface IJBMultiTerminal {
    function pay(
        uint256 projectId,
        address token,
        uint256 amount,
        address beneficiary,
        uint256 minReturnedTokens,
        string calldata memo,
        bytes calldata metadata
    ) external payable returns (uint256 beneficiaryTokenCount);
}

/**
 * Deploy on source and destination chain with appropriate lzEndpoint and Stargate router.
 * Stargate v2 contracts: https://stargateprotocol.gitbook.io/stargate/developers/contract-addresses/mainnet
 * Then configure peers using setPeer() function with destination chain EID and contract address.
 */
contract CrossChainPay is Ownable {
    IJBMultiTerminal public jbMultiTerminal;
    IStargate public stargateRouter;
    
    // Events
    event CrossChainPayInitiated(
        uint32 indexed dstEid,
        uint256 indexed projectId,
        uint256 amount,
        address beneficiary
    );
    
    event CrossChainPayReceived(
        uint256 indexed projectId,
        uint256 amount,
        address beneficiary
    );

    constructor(
        address _owner,
        address _jbMultiTerminalAddress,
        address _stargateRouter
    ) Ownable(_owner) {
        jbMultiTerminal = IJBMultiTerminal(_jbMultiTerminalAddress);
        stargateRouter = IStargate(_stargateRouter);
    }

    function crossChainPay(
        uint32 _dstEid,
        uint256 _projectId,
        uint256 _amount,
        address _beneficiary,
        uint256 _minReturnedTokens,
        string calldata _memo,
        bytes calldata _metadata,
        bytes calldata _extraOptions
    ) external payable {
        require(_amount > 0, "Amount must be greater than 0");
        require(msg.value >= _amount, "Insufficient ETH sent");

        // Encode the payload for the destination chain
        bytes memory composeMsg = abi.encode(
            _projectId,
            _beneficiary,
            _minReturnedTokens,
            _memo,
            _metadata
        );

        // Prepare Stargate send parameters
        IStargate.SendParam memory sendParam = IStargate.SendParam({
            dstEid: _dstEid,
            to: bytes32(uint256(uint160(address(this)))), // Convert address to bytes32
            amountLD: _amount,
            minAmountLD: _amount * 95 / 100, // 5% slippage tolerance
            extraOptions: _extraOptions,
            composeMsg: composeMsg,
            oftCmd: ""
        });

        // Get quote for the cross-chain transfer
        IStargate.MessagingFee memory msgFee = stargateRouter.quoteSend(sendParam, false);
        
        // Ensure sufficient ETH for both transfer amount and fees
        require(msg.value >= _amount + msgFee.nativeFee, "Insufficient ETH for transfer and fees");

        // Execute the cross-chain transfer
        stargateRouter.send{value: msg.value}(
            sendParam,
            msgFee,
            payable(msg.sender) // Refund address
        );

        emit CrossChainPayInitiated(_dstEid, _projectId, _amount, _beneficiary);
    }

    function quoteCrossChainPay(
        uint32 _dstEid,
        uint256 _amount,
        uint256 _projectId,
        address _beneficiary,
        uint256 _minReturnedTokens,
        string calldata _memo,
        bytes calldata _metadata,
        bytes calldata _extraOptions
    ) external view returns (uint256 nativeFee) {
        bytes memory composeMsg = abi.encode(
            _projectId,
            _beneficiary,
            _minReturnedTokens,
            _memo,
            _metadata
        );

        IStargate.SendParam memory sendParam = IStargate.SendParam({
            dstEid: _dstEid,
            to: bytes32(uint256(uint160(address(this)))),
            amountLD: _amount,
            minAmountLD: _amount * 95 / 100,
            extraOptions: _extraOptions,
            composeMsg: composeMsg,
            oftCmd: ""
        });

        IStargate.MessagingFee memory msgFee = stargateRouter.quoteSend(sendParam, false);
        return msgFee.nativeFee + _amount; // Total ETH needed (transfer + fees)
    }

    // This function is called by Stargate when tokens arrive on the destination chain
    function lzCompose(
        Origin calldata /*_origin*/,
        bytes32 /*_guid*/,
        bytes calldata _message,
        address /*_executor*/,
        bytes calldata /*_extraData*/
    ) external payable {
        // Verify the call is from Stargate router
        require(msg.sender == address(stargateRouter), "Only Stargate router can call");

        // Decode the message
        (
            uint256 projectId,
            address beneficiary,
            uint256 minReturnedTokens,
            string memory memo,
            bytes memory metadata
        ) = abi.decode(_message, (uint256, address, uint256, string, bytes));

        // Execute the payment to Juicebox
        uint256 tokenCount = jbMultiTerminal.pay{value: msg.value}(
            projectId,
            address(0), // ETH
            msg.value,
            beneficiary,
            minReturnedTokens,
            memo,
            metadata
        );

        emit CrossChainPayReceived(projectId, msg.value, beneficiary);
    }

    // Admin functions
    function setJbMultiTerminalAddress(address _jbMultiTerminalAddress) external onlyOwner {
        jbMultiTerminal = IJBMultiTerminal(_jbMultiTerminalAddress);
    }

    function setStargateRouter(address _stargateRouter) external onlyOwner {
        stargateRouter = IStargate(_stargateRouter);
    }

    // Emergency functions
    function emergencyWithdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    // Allow contract to receive ETH
    receive() external payable {}
}
