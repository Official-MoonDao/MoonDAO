// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "base/Config.sol";

/// @title DePrizeLaunchConfigTest
/// @notice AUDIT[plan 1.3 / 1.5]: launch-config invariants after Phase 2.
///         CI-safe (no RPC).
///
/// Inherits Config (not forge-std/Test) to avoid a dual-import of stdMath.
contract DePrizeLaunchConfigTest is Config {
    function testArbitrumWethIsCanonicalAeWeth() public view {
        require(WETH_ADDRESSES[ARBITRUM] == 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1, "weth");
    }

    function testArbitrumCtfAndFactoryMatchPhase2() public view {
        require(
            CONDITIONAL_TOKENS_ADDRESSES[ARBITRUM] == 0x12DAC07Bf586E06a9bDa32c422864C8Fda43FA29,
            "ctf"
        );
        require(
            LMSR_FACTORY_ADDRESSES[ARBITRUM] == 0xb40d77bD8C3D8CF38c4b88D649D397efa2dd2cB8,
            "factory"
        );
    }

    function testRequireDePrizeCollateralSepoliaOk() public view {
        (address weth, address ctf) = requireDePrizeCollateral(SEP);
        require(weth == 0x8cfF28F922AeEe80d3a0663e735681469F7374c6, "sep weth");
        require(ctf == 0xC3B0a34fb9a1c5F9464D7249BF564117e1fe6dE8, "sep ctf");
    }

    function testRequireDePrizeCollateralArbitrumOk() public view {
        (address weth, address ctf) = requireDePrizeCollateral(ARBITRUM);
        require(weth == 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1, "arb weth");
        require(ctf == 0x12DAC07Bf586E06a9bDa32c422864C8Fda43FA29, "arb ctf");
    }
}
