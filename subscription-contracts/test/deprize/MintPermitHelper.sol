// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {DePrizeMint} from "../../src/deprize/DePrizeMint.sol";

/// @dev Shared EIP-712 permit helper for DePrizeMint tests. Every `bet` now
///      requires a `CompliancePermit` from `complianceSigner`; tests inherit
///      this and call `_initCompliance` in `setUp`.
abstract contract MintPermitHelper is Test {
    uint256 internal constant COMPLIANCE_PK = uint256(keccak256("deprize-compliance-signer"));

    address internal complianceSigner;

    function _initCompliance(DePrizeMint mint, address owner) internal {
        complianceSigner = vm.addr(COMPLIANCE_PK);
        vm.prank(owner);
        mint.setComplianceSigner(complianceSigner);
    }

    function _permit(DePrizeMint mint, address wallet, uint256 deprizeId)
        internal
        view
        returns (uint256 deadline, bytes memory signature)
    {
        deadline = block.timestamp + 1 hours;
        bytes32 digest = mint.hashPermit(wallet, deprizeId, deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(COMPLIANCE_PK, digest);
        signature = abi.encodePacked(r, s, v);
    }

    function _bet(
        DePrizeMint mint,
        address who,
        uint256 value,
        uint256 deprizeId,
        uint256 outcomeIndex,
        uint256 qty,
        uint256 maxCost
    ) internal {
        (uint256 deadline, bytes memory signature) = _permit(mint, who, deprizeId);
        vm.prank(who);
        mint.bet{value: value}(deprizeId, outcomeIndex, qty, maxCost, deadline, signature);
    }
}
