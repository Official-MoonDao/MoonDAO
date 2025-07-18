// Helper to mine a CREATE2 address with a specific prefix eg. 0xDA0
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

library Miner {
    uint256 constant MAX_LOOP    = 160_444;
    uint256 constant SHIFT_BITS  = 160 - 12; // drop low 148 bits

    /// @notice Blitz through salts until the top-3-hex match
    function find(
        address deployer,
        uint16 prefix,
        bytes memory creationCode,
        bytes memory constructorArgs
    )
        internal
        view
        returns (address hookAddress, bytes32 salt)
    {
        require(prefix <= 0xFFF, "Prefix > 3 hex digits");
        // pack & hash once
        bytes memory initCode      = abi.encodePacked(creationCode, constructorArgs);
        bytes32     initCodeHash  = keccak256(initCode);

        // loop without repeated hashing of initCode!
        for (uint256 i = 0; i < MAX_LOOP; ) {
            hookAddress = _computeAddress(deployer, i, initCodeHash);

            // empty & prefix check
            if (hookAddress.code.length == 0 &&
                (uint160(hookAddress) >> SHIFT_BITS) == prefix
            ) {
                return (hookAddress, bytes32(i));
            }

            unchecked { ++i; }
        }
        revert("HookMiner: no matching salt");
    }

    /// @dev Fast CREATE2 address from deployer, salt, and pre-hashed init code
    function _computeAddress(
        address deployer,
        uint256 salt,
        bytes32 initCodeHash
    ) private pure returns (address)
    {
        // single keccak for the CREATE2 derivation
        bytes32 fullHash = keccak256(
            abi.encodePacked(bytes1(0xFF), deployer, salt, initCodeHash)
        );
        return address(uint160(uint256(fullHash)));
    }
}
