// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {IJBController} from "@nana-core-v5/interfaces/IJBController.sol";
import {IJBMultiTerminal} from "@nana-core-v5/interfaces/IJBMultiTerminal.sol";
import {JBRulesetMetadata} from "@nana-core-v5/structs/JBRulesetMetadata.sol";
import {JBConstants} from "@nana-core-v5/libraries/JBConstants.sol";

interface ISafe {
    function getOwners() external view returns (address[] memory);
    function getThreshold() external view returns (uint256);
    function nonce() external view returns (uint256);
    function approveHash(bytes32 hashToApprove) external;
    function getTransactionHash(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address refundReceiver,
        uint256 _nonce
    ) external view returns (bytes32);
    function execTransaction(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address payable refundReceiver,
        bytes memory signatures
    ) external payable returns (bool);
}

/// @title Mission4OwnerOnlyPayoutsForkTest
/// @notice Live-state fork test of the Mission 4 / project 73 fix on Arbitrum.
///
/// Demonstrates the full BEFORE → APPLY → AFTER lifecycle:
///   • BEFORE: a random EOA can call `sendPayoutsOf` and force the terminal
///     to distribute funds (current vulnerability).
///   • APPLY:  the Safe at 0xaA1B…B5EA executes the **exact JSON calldata**
///     from `script/safe-tx-mission4-owner-only-payouts.json` through
///     `execTransaction(...)` with 3 pre-approved-hash signatures.
///   • AFTER:  the same random EOA reverts; the Safe (project owner) can
///     still send payouts; ruleset metadata reads `ownerMustSendPayouts: true`.
///
/// READ-ONLY against mainnet: simulation only, never broadcasts.
///
/// Run:
///   forge test --match-contract Mission4OwnerOnlyPayoutsForkTest \
///     --fork-url https://arb1.arbitrum.io/rpc \
///     --via-ir --optimizer-runs 200 --ffi -vv
contract Mission4OwnerOnlyPayoutsForkTest is Test {
    // ── Live Arbitrum addresses ──
    address constant SAFE       = 0xaA1Bd6d001C0000420090EDb36bEAE0D9393B5EA;
    address constant CONTROLLER = 0x27da30646502e2f642bE5281322Ae8C394F7668a;
    address constant TERMINAL   = 0x2dB6d704058E552DeFE415753465df8dF0361846;

    uint256 constant PROJECT_ID = 73;
    address constant ATTACKER   = address(0xBEEF);

    bytes calldataBlob; // the `data` field from the Safe Tx Builder JSON

    function setUp() public {
        // Load the exact bytes that the Safe Tx Builder JSON submits, so the
        // test fails if anyone ever tampers with the JSON or its encoding.
        string memory json = vm.readFile("./script/safe-tx-mission4-owner-only-payouts.json");
        calldataBlob = vm.parseBytes(vm.parseJsonString(json, ".transactions[0].data"));
        assertEq(calldataBlob.length, 2852, "JSON calldata length mismatch");
        assertEq(bytes4(_first4(calldataBlob)), IJBController.queueRulesetsOf.selector);

        // Fund attacker so they can pay gas for sendPayoutsOf in fork.
        vm.deal(ATTACKER, 1 ether);
    }

    /// @notice Asserts current ruleset has `ownerMustSendPayouts == false`.
    function test_State_BeforeFix_FlagIsFalse() public view {
        (, JBRulesetMetadata memory meta) =
            IJBController(CONTROLLER).currentRulesetOf(PROJECT_ID);
        assertEq(meta.ownerMustSendPayouts, false, "expected baseline false");
    }

    /// @notice Demonstrates the live vulnerability: any EOA can call
    ///         `sendPayoutsOf` on Mission 4 today.
    function test_Vulnerability_AnyoneCanSendPayouts_BeforeFix() public {
        uint256 snap = vm.snapshot();
        vm.prank(ATTACKER);
        uint256 amt = IJBMultiTerminal(TERMINAL).sendPayoutsOf(
            PROJECT_ID,
            JBConstants.NATIVE_TOKEN,
            1, // 1 wei keeps the sim cheap; non-zero proves the gate is open
            uint32(uint160(JBConstants.NATIVE_TOKEN)),
            0
        );
        assertGt(amt, 0, "BEFORE fix: random EOA should be able to trigger payouts");
        vm.revertTo(snap);
    }

    /// @notice End-to-end fix: executes the JSON via the real Safe with 3
    ///         pre-approved-hash signatures, then asserts both:
    ///           - non-owner reverts on sendPayoutsOf
    ///           - Safe (owner) can still send payouts
    ///           - ruleset metadata reads `ownerMustSendPayouts: true`
    function test_Fix_AfterSafeExecTransaction_BlocksAttacker_AllowsSafe() public {
        // ── APPLY: route the JSON calldata through Safe.execTransaction ──
        ISafe safe = ISafe(SAFE);
        address[] memory owners = _sortAsc(safe.getOwners());
        uint256 threshold = safe.getThreshold();

        bytes32 txHash = safe.getTransactionHash(
            CONTROLLER, 0, calldataBlob, 0, 0, 0, 0, address(0), address(0), safe.nonce()
        );

        bytes memory sigs;
        for (uint256 i = 0; i < threshold; i++) {
            address o = owners[i];
            vm.prank(o);
            safe.approveHash(txHash);
            sigs = abi.encodePacked(sigs, bytes32(uint256(uint160(o))), bytes32(0), uint8(1));
        }

        bool ok = safe.execTransaction(
            CONTROLLER, 0, calldataBlob, 0, 0, 0, 0, address(0), payable(address(0)), sigs
        );
        assertTrue(ok, "Safe execTransaction failed");

        // The new ruleset has duration=0 → effective on the next block.
        vm.warp(block.timestamp + 1);
        vm.roll(block.number + 1);

        // ── ASSERT 1: the metadata flag is now true ──
        (, JBRulesetMetadata memory meta) =
            IJBController(CONTROLLER).currentRulesetOf(PROJECT_ID);
        assertEq(meta.ownerMustSendPayouts, true, "AFTER fix: flag should be true");

        // ── ASSERT 2: random EOA can no longer trigger payouts ──
        vm.prank(ATTACKER);
        vm.expectRevert(); // JBPermissioned: unauthorized
        IJBMultiTerminal(TERMINAL).sendPayoutsOf(
            PROJECT_ID,
            JBConstants.NATIVE_TOKEN,
            1,
            uint32(uint160(JBConstants.NATIVE_TOKEN)),
            0
        );

        // ── ASSERT 3: Safe (project owner) CAN still trigger payouts ──
        vm.prank(SAFE);
        uint256 paid = IJBMultiTerminal(TERMINAL).sendPayoutsOf(
            PROJECT_ID,
            JBConstants.NATIVE_TOKEN,
            1,
            uint32(uint160(JBConstants.NATIVE_TOKEN)),
            0
        );
        assertGt(paid, 0, "Safe must still be able to send payouts after fix");
    }

    // ── helpers ──

    function _sortAsc(address[] memory a) internal pure returns (address[] memory) {
        address[] memory r = a;
        for (uint256 i = 0; i < r.length; i++) {
            for (uint256 j = i + 1; j < r.length; j++) {
                if (r[j] < r[i]) (r[i], r[j]) = (r[j], r[i]);
            }
        }
        return r;
    }

    function _first4(bytes memory b) internal pure returns (bytes4 out) {
        assembly { out := mload(add(b, 0x20)) }
    }
}
