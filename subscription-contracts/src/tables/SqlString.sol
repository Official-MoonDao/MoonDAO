// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice SQL string literals for Tableland statements built from user text.
/// @dev `SQLHelpers.quote` only wraps quotes. A value containing `'` would
/// close the literal and let the validator run whatever followed it.
library SqlString {
    error InvalidText();

    /// @notice Wrap `s` as a SQL string literal, doubling every single quote.
    /// Reverts if `s` contains a NUL byte.
    function quote(string memory s) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        uint256 quotes;
        for (uint256 i; i < b.length; ++i) {
            if (b[i] == 0x00) revert InvalidText();
            if (b[i] == 0x27) ++quotes;
        }
        bytes memory out = new bytes(b.length + quotes + 2);
        out[0] = 0x27;
        uint256 j = 1;
        for (uint256 i; i < b.length; ++i) {
            out[j++] = b[i];
            if (b[i] == 0x27) out[j++] = 0x27;
        }
        out[j] = 0x27;
        return string(out);
    }
}
