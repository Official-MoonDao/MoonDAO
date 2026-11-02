// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

/// @notice `vm.deal` that survives a forked CI RPC answering 429.
///
/// `forge coverage --fork-url` reads each account from upstream before it can
/// set a balance. Thirdweb rate-limits those lookups, and the revert happens
/// in `setUp`, so the test never starts. Call `dealRetry` instead of `vm.deal`.
abstract contract ForkDeal is Test {
    function dealRetry(address to, uint256 give) internal {
        for (uint256 attempt; attempt < 3; ++attempt) {
            try this.dealOnce(to, give) {
                return;
            } catch {
                // Milliseconds. Back off while the upstream limit window passes.
                vm.sleep(1000 << attempt);
            }
        }
        this.dealOnce(to, give);
    }

    /// @dev External so the caller can catch a rate-limit revert and retry.
    function dealOnce(address to, uint256 give) external {
        vm.deal(to, give);
    }
}
