// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./interfaces/IXPOracle.sol";

/**
 * @title XPOracle
 * @notice Shared oracle used by multiple XP verifiers to validate off-chain computed eligibility proofs
 * @dev EIP-712 typed-data signatures. Owner manages a set of authorized signers.
 */
contract XPOracle is Ownable, EIP712, IXPOracle {
    using ECDSA for bytes32;

    // keccak256("Proof(address user,address verifier,bytes32 contextHash,uint256 xpAmount,uint256 validAfter,uint256 validBefore)")
    bytes32 public constant PROOF_TYPEHASH = keccak256(
        "Proof(address user,address verifier,bytes32 contextHash,uint256 xpAmount,uint256 validAfter,uint256 validBefore)"
    );

    mapping(address => bool) private authorizedSigners;

    event SignerUpdated(address indexed signer, bool authorized);

    constructor(string memory appName, string memory appVersion) Ownable(msg.sender) EIP712(appName, appVersion) {}

    function setSigner(address signer, bool authorized) external onlyOwner {
        require(signer != address(0), "invalid signer");
        authorizedSigners[signer] = authorized;
        emit SignerUpdated(signer, authorized);
    }

    function isSigner(address account) external view returns (bool) {
        return authorizedSigners[account];
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function verifyProof(Proof calldata proof, bytes calldata signature) external view returns (bool) {
        // time window
        if (proof.validAfter != 0 && block.timestamp < proof.validAfter) return false;
        if (proof.validBefore != 0 && block.timestamp > proof.validBefore) return false;

        bytes32 structHash = keccak256(
            abi.encode(
                PROOF_TYPEHASH,
                proof.user,
                proof.verifier,
                proof.contextHash,
                proof.xpAmount,
                proof.validAfter,
                proof.validBefore
            )
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, signature);
        return authorizedSigners[signer];
    }
}


