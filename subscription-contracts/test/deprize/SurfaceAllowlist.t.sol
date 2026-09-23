// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

/// @title SurfaceAllowlist
/// @notice Pins the external ABI of every DePrize v2 contract. The point of v2 is a
///         smaller attack surface; this test makes any selector added to (or
///         removed from) Registry / Mint / Redeem a deliberate, reviewed change.
///
///         Reads `methodIdentifiers` from the forge artifact and compares it with
///         `test/deprize/surface/<Contract>.txt` (one `name(types)` per line,
///         sorted). To regenerate after an intentional change:
///           DEPRIZE_SURFACE_WRITE=true forge test --match-contract SurfaceAllowlist
contract SurfaceAllowlistTest is Test {
    string[3] internal CONTRACTS = ["DePrizeRegistry", "DePrizeMint", "DePrizeRedeem"];

    function testSurfaceMatchesAllowlist() public {
        bool write = vm.envOr("DEPRIZE_SURFACE_WRITE", false);
        for (uint256 c = 0; c < CONTRACTS.length; c++) {
            string memory name = CONTRACTS[c];
            string memory artifact = vm.readFile(string.concat("out/", name, ".sol/", name, ".json"));
            string[] memory sigs = vm.parseJsonKeys(artifact, ".methodIdentifiers");
            _sort(sigs);
            string memory actual = _join(sigs);

            string memory path = string.concat("test/deprize/surface/", name, ".txt");
            if (write) {
                vm.writeFile(path, actual);
                continue;
            }
            string memory expected = vm.readFile(path);
            assertEq(actual, expected, string.concat(name, " external surface changed; see ", path));
        }
    }

    function testForbiddenSelectorsAreGone() public {
        // Selectors that defined the v1 surface and must never come back.
        string[12] memory banned = [
            "initialize(address)",
            "initialize(address,address,address,address,address)",
            "upgradeToAndCall(address,bytes)",
            "proxiableUUID()",
            "setFeeRouter(address)",
            "feeRouter()",
            "releaseM1(uint256)",
            "completeM2(uint256)",
            "failM2(uint256)",
            "startVote(uint256)",
            "setProviderPayoutAddress(uint256,address)",
            "markWithdrawn(uint256,uint256)"
        ];
        for (uint256 c = 0; c < CONTRACTS.length; c++) {
            string memory artifact =
                vm.readFile(string.concat("out/", CONTRACTS[c], ".sol/", CONTRACTS[c], ".json"));
            string[] memory sigs = vm.parseJsonKeys(artifact, ".methodIdentifiers");
            for (uint256 i = 0; i < sigs.length; i++) {
                for (uint256 b = 0; b < banned.length; b++) {
                    assertTrue(
                        keccak256(bytes(sigs[i])) != keccak256(bytes(banned[b])),
                        string.concat(CONTRACTS[c], " exposes banned selector ", banned[b])
                    );
                }
            }
        }
    }

    function _join(string[] memory parts) internal pure returns (string memory out) {
        for (uint256 i = 0; i < parts.length; i++) {
            out = string.concat(out, parts[i], "\n");
        }
    }

    function _sort(string[] memory arr) internal pure {
        for (uint256 i = 1; i < arr.length; i++) {
            string memory key = arr[i];
            uint256 j = i;
            while (j > 0 && _gt(arr[j - 1], key)) {
                arr[j] = arr[j - 1];
                j--;
            }
            arr[j] = key;
        }
    }

    function _gt(string memory a, string memory b) internal pure returns (bool) {
        bytes memory x = bytes(a);
        bytes memory y = bytes(b);
        uint256 n = x.length < y.length ? x.length : y.length;
        for (uint256 i = 0; i < n; i++) {
            if (x[i] != y[i]) return x[i] > y[i];
        }
        return x.length > y.length;
    }
}
