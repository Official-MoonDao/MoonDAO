// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Citizen mint allowlist with a single minter. MoonDAOCitizen only
///         calls `isWhitelisted`. The Admin Safe points the citizen contract at
///         this list so direct `mintTo` calls cannot skip the MOONEY stake.
contract CheckoutOnlyMinter {
    address public immutable checkout;

    constructor(address checkout_) {
        require(checkout_ != address(0), "checkout");
        checkout = checkout_;
    }

    function isWhitelisted(address who) external view returns (bool) {
        return who == checkout;
    }
}
