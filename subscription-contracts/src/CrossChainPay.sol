// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { ILayerZeroComposer } from "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroComposer.sol";
import { OptionsBuilder } from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OptionsBuilder.sol";
import { OApp, Origin, MessagingFee } from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import {JBConstants} from "@nana-core/libraries/JBConstants.sol";
import { OFTComposeMsgCodec } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/libs/OFTComposeMsgCodec.sol";


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
 * Deploy on source and destination chain with appropriate Stargate router.
 * Stargate v2 contracts: https://stargateprotocol.gitbook.io/stargate/developers/contract-addresses/mainnet
 * Then configure peers using setPeer() function with destination chain EID and contract address.
 */
contract CrossChainPay is ILayerZeroComposer, Ownable {
    using OptionsBuilder for bytes;
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
        bytes calldata _metadata
    ) external payable {
        require(_amount > 0, "Amount must be greater than 0");
        require(msg.value >= _amount, "Insufficient ETH sent");
        bytes memory composeMsg = abi.encode(
            _projectId,
            _beneficiary,
            _minReturnedTokens,
            _memo,
            _metadata
        );
        bytes memory extraOptions = composeMsg.length > 0
            ? OptionsBuilder.newOptions().addExecutorLzComposeOption(0, 800_000, uint128(_amount * 998 / 1_000)) // compose gas limit
            : bytes("");
        IStargate.SendParam memory sendParam = IStargate.SendParam({
            dstEid: _dstEid,
            to: bytes32(uint256(uint160(address(this)))), // Convert address to bytes32
            amountLD: _amount,
            minAmountLD: _amount * 998 / 1_000, // 5% slippage tolerance
            extraOptions: extraOptions,
            composeMsg: composeMsg,
            oftCmd: ""
        });

        IStargate.MessagingFee memory msgFee = stargateRouter.quoteSend(sendParam, false);
        require(msg.value >= _amount + msgFee.nativeFee, "Insufficient ETH for transfer and fees");

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
        bytes calldata _metadata
    ) external view returns (uint256 nativeFee) {
        bytes memory composeMsg = abi.encode(
            _projectId,
            _beneficiary,
            _minReturnedTokens,
            _memo,
            _metadata
        );

        bytes memory extraOptions = composeMsg.length > 0
            ? OptionsBuilder.newOptions().addExecutorLzComposeOption(0, 800_000, uint128(_amount * 998 / 1_000)) // compose gas limit
            : bytes("");
        IStargate.SendParam memory sendParam = IStargate.SendParam({
            dstEid: _dstEid,
            to: bytes32(uint256(uint160(address(this)))),
            amountLD: _amount,
            minAmountLD: _amount * 998 / 1_000, // 0.5% slippage tolerance
            extraOptions: extraOptions,
            composeMsg: composeMsg,
            oftCmd: ""
        });

        IStargate.MessagingFee memory msgFee = stargateRouter.quoteSend(sendParam, false);
        return msgFee.nativeFee + _amount; // Total ETH needed (transfer + fees)
    }
    // This function is called by Stargate when tokens arrive on the destination chain
    function lzCompose(
        address _from /*_origin*/,
        bytes32 /*_guid*/,
        bytes calldata _message,
        address /*_executor*/,
        bytes calldata /*_extraData*/
    ) external payable {
        bytes memory _composeMessage = OFTComposeMsgCodec.composeMsg(_message);
        (
            uint256 projectId,
            address beneficiary,
            uint256 minReturnedTokens,
            string memory memo,
            bytes memory metadata
        ) = abi.decode(_composeMessage, (uint256, address, uint256, string, bytes));

        uint256 tokenCount = jbMultiTerminal.pay{value: msg.value}(
            projectId,
            JBConstants.NATIVE_TOKEN,
            0,
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
    fallback() external payable {}
}
