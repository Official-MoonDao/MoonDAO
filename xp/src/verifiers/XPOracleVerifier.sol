// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IXPOracle.sol";
import "../interfaces/IXPVerifier.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title XPOracleVerifier
/// @notice Abstract base for oracle-backed XP verifiers
/// @dev Holds shared oracle state/logic. Concrete verifiers implement IXPVerifier.
abstract contract XPOracleVerifier is Ownable, IXPVerifier {
    IXPOracle public oracle;
    event OracleUpdated(address indexed oldOracle, address indexed newOracle);

    constructor(address _oracle) Ownable(msg.sender) {
        require(_oracle != address(0), "Invalid oracle address");
        oracle = IXPOracle(_oracle);
    }

    function updateOracle(address newOracle) external onlyOwner {
        require(newOracle != address(0), "Invalid oracle address");
        address oldOracle = address(oracle);
        oracle = IXPOracle(newOracle);
        emit OracleUpdated(oldOracle, newOracle);
    }

    /// @notice Helper to verify an oracle proof for a given user/context
    /// @dev Reverts on invalid proof; returns xpAmount for convenience
    function _verifyOracleProof(
        address user,
        bytes32 contextHash,
        uint256 xpAmount,
        uint256 validAfter,
        uint256 validBefore,
        bytes memory signature
    ) internal view returns (uint256) {
        IXPOracle.Proof memory proof = IXPOracle.Proof({
            user: user,
            verifier: address(this),
            contextHash: contextHash,
            xpAmount: xpAmount,
            validAfter: validAfter,
            validBefore: validBefore
        });

        bool ok = oracle.verifyProof(proof, signature);
        require(ok, "Invalid oracle proof");
        return xpAmount;
    }
}


