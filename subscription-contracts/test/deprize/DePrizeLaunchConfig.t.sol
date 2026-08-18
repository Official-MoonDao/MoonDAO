// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "base/Config.sol";

/// @title DePrizeLaunchConfigTest
/// @notice AUDIT[plan 1.3 / 1.5]: launch-config invariants that must hold
///         *before* Phase 2 CTF exists. CI-safe (no RPC).
///
/// Inherits Config (not forge-std/Test) to avoid a dual-import of stdMath.
contract DePrizeLaunchConfigTest is Config {
    function testArbitrumWethIsCanonicalAeWeth() public view {
        require(WETH_ADDRESSES[ARBITRUM] == 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1, "weth");
    }

    function testArbitrumCtfAndFactoryUnsetUntilPhase2() public view {
        require(CONDITIONAL_TOKENS_ADDRESSES[ARBITRUM] == address(0), "ctf invented");
        require(LMSR_FACTORY_ADDRESSES[ARBITRUM] == address(0), "factory invented");
    }

    function testRequireDePrizeCollateralSepoliaOk() public view {
        (address weth, address ctf) = requireDePrizeCollateral(SEP);
        require(weth == 0x8cfF28F922AeEe80d3a0663e735681469F7374c6, "sep weth");
        require(ctf == 0xC3B0a34fb9a1c5F9464D7249BF564117e1fe6dE8, "sep ctf");
    }

    function testRequireDePrizeCollateralArbitrumRevertsUntilCtf() public {
        try this.requireDePrizeCollateral(ARBITRUM) {
            revert("expected revert until Phase 2 CTF is configured");
        } catch {}
    }
}
