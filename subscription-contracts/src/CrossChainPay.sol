// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { OApp, Origin, MessagingFee } from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";


interface IJBMultiTerminal {
    function pay(
        uint256 projectId,
        address token,
        uint256 amount,
        address beneficiary,
        uint256 minReturnedTokens,
        string calldata memo,
        bytes calldata metadata
    )
        external
        payable
        returns (uint256 beneficiaryTokenCount);
}


/**
Deploy on source and destination chain with appropriate lzEndpoint.
(https://docs.layerzero.network/v2/developers/evm/technical-reference/deployed-contracts)

Then run script/CrossChainPayConnect.s.sol on both chains with the appropriate source address,
destination address and destination endpoint id.
*/
contract CrossChainPay is OApp {
    IJBMultiTerminal public jbMultiTerminal;
    constructor(address _owner, address _endpoint, address _jbMultiTerminalAddress) OApp(_endpoint, _owner) Ownable(_owner) {
        jbMultiTerminal = IJBMultiTerminal(_jbMultiTerminalAddress);
    }

    function crossChainPay(
        uint16 _dstEid,
        bytes calldata _options,
        uint256 projectId,
        address token,
        uint256 amount,
        address beneficiary,
        uint256 minReturnedTokens,
        string calldata memo,
        bytes calldata metadata
    ) external payable {
        bytes memory payload = abi.encode(
            projectId,
            token,
            amount,
            beneficiary,
            minReturnedTokens,
            memo,
            metadata
        );

        _lzSend(
            _dstEid,        // destination chainId
            payload,            // bytes payload
            _options,           // bytes options
            MessagingFee(msg.value, 0),
            payable(msg.sender)
        );
    }

    function setJbMultiTerminalAddress(address _jbMultiTerminalAddress) external onlyOwner {
        jbMultiTerminal = IJBMultiTerminal(_jbMultiTerminalAddress);
    }

    function _lzReceive(
        Origin calldata _origin,
        bytes32 _guid,
        bytes calldata payload,
        address,  // Executor address as specified by the OApp.
        bytes calldata  // Any extra data or options to trigger on receipt.
    ) internal override {
        (
            uint256 projectId,
            address token,
            uint256 amount,
            address beneficiary,
            uint256 minReturnedTokens,
            string memory memo,
            bytes memory metadata
        ) = abi.decode(
            payload,
            (uint256, address, uint256, address, uint256, string, bytes)
        );
        jbMultiTerminal.pay{value: amount}(
            projectId,
            token,
            amount,
            beneficiary,
            minReturnedTokens,
            memo,
            metadata
        );
    }
}
