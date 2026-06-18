// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import {IDePrizeRegistry} from "./IDePrizeRegistry.sol";
import {IConditionalTokens} from "./interfaces/IConditionalTokens.sol";
import {IWETH} from "./interfaces/IWETH.sol";

/// @title DePrizeRedeem
/// @notice Bettor redemption helper for resolved DePrize markets. A single
///         `redeem` call pulls the caller's outcome tokens (one-time
///         `ctf.setApprovalForAll(address(this), true)` required), redeems them
///         on the Gnosis CTF, unwraps the WETH payout, and pays the caller ETH.
///
///         Serves BOTH payout paths with the same code:
///         - winner resolution (`[0,…,1,…,0]`): winning tokens pay full value;
///         - no-winner / cancellation resolution (`[1,1,…,1]`): every token pays
///           1/N (the disclosed parimutuel refund).
///
/// @dev Deliberately thin, stateless between calls, and NON-custodial:
///      redemption is already permissionless on the CTF (bettors hold the
///      ERC-1155 outcome tokens directly since M3 and can always call
///      `ctf.redeemPositions` themselves — they would just receive WETH instead
///      of ETH). Because anyone can bypass this contract, it adds no lifecycle
///      gates: the CTF payout vector (`payoutDenominator`) is the sole source
///      of truth for when/what redemption pays. It is also intentionally
///      non-upgradeable — no state worth migrating, smaller trust surface.
contract DePrizeRedeem is ReentrancyGuard, IERC1155Receiver {
    IDePrizeRegistry public immutable registry;
    IConditionalTokens public immutable ctf;
    IWETH public immutable weth;

    /// @dev True only while `redeem` is pulling the caller's outcome tokens;
    ///      gates the ERC-1155 acceptance hooks (no unsolicited deposits).
    bool private _inRedeem;

    event Redeemed(uint256 indexed deprizeId, address indexed account, uint256 payout);

    error ZeroAddress();
    error UnknownDePrize(uint256 deprizeId);
    error NotResolved(uint256 deprizeId);
    error NothingToRedeem(uint256 deprizeId, address account);
    error RedeemFailed();
    error UnexpectedERC1155();
    error SlotCountMismatch(uint256 deprizeId, uint256 teamIds, uint256 outcomeSlots);

    constructor(address registry_, address ctf_, address weth_) {
        if (registry_ == address(0) || ctf_ == address(0) || weth_ == address(0)) revert ZeroAddress();
        registry = IDePrizeRegistry(registry_);
        ctf = IConditionalTokens(ctf_);
        weth = IWETH(weth_);
    }

    // ---------------------------------------------------------------------
    // Redemption
    // ---------------------------------------------------------------------

    /// @notice Redeem all of `msg.sender`'s outcome tokens for `deprizeId` and
    ///         pay out the proceeds in ETH. Requires the caller to have approved
    ///         this contract on the CTF (`setApprovalForAll`). Reverts until the
    ///         oracle has resolved the condition.
    function redeem(uint256 deprizeId) external nonReentrant {
        (bytes32 conditionId, uint256[] memory positionIds) = _positions(deprizeId);
        if (ctf.payoutDenominator(conditionId) == 0) revert NotResolved(deprizeId);

        // Find the caller's nonzero positions.
        uint256 n = positionIds.length;
        address[] memory owners = new address[](n);
        for (uint256 i = 0; i < n; i++) {
            owners[i] = msg.sender;
        }
        uint256[] memory balances = ctf.balanceOfBatch(owners, positionIds);

        uint256 held;
        for (uint256 i = 0; i < n; i++) {
            if (balances[i] > 0) held++;
        }
        if (held == 0) revert NothingToRedeem(deprizeId, msg.sender);

        uint256[] memory ids = new uint256[](held);
        uint256[] memory values = new uint256[](held);
        uint256[] memory indexSets = new uint256[](held);
        uint256 j;
        for (uint256 i = 0; i < n; i++) {
            if (balances[i] > 0) {
                ids[j] = positionIds[i];
                values[j] = balances[i];
                indexSets[j] = 1 << i;
                j++;
            }
        }

        // Pull the caller's tokens (acceptance hooks gated by _inRedeem), then
        // burn them on the CTF for WETH. Scope the payout to the WETH RECEIVED
        // BY THIS REDEMPTION (balance delta) so stray WETH parked in this
        // contract can never leak into a caller's payout.
        _inRedeem = true;
        ctf.safeBatchTransferFrom(msg.sender, address(this), ids, values, "");
        _inRedeem = false;

        uint256 wethBefore = weth.balanceOf(address(this));
        ctf.redeemPositions(address(weth), bytes32(0), conditionId, indexSets);
        uint256 payout = weth.balanceOf(address(this)) - wethBefore;

        if (payout > 0) {
            weth.withdraw(payout);
            (bool ok,) = msg.sender.call{value: payout}("");
            if (!ok) revert RedeemFailed();
        }

        emit Redeemed(deprizeId, msg.sender, payout);
    }

    /// @notice ETH `account` would receive from `redeem(deprizeId)` right now.
    ///         Returns 0 if the condition is not resolved yet (or nothing is held).
    /// @dev Mirrors the CTF's integer math exactly: floor division PER POSITION.
    function previewRedeem(uint256 deprizeId, address account) external view returns (uint256 payout) {
        (bytes32 conditionId, uint256[] memory positionIds) = _positions(deprizeId);
        uint256 den = ctf.payoutDenominator(conditionId);
        if (den == 0) return 0;

        for (uint256 i = 0; i < positionIds.length; i++) {
            uint256 stake = ctf.balanceOf(account, positionIds[i]);
            if (stake > 0) {
                payout += stake * ctf.payoutNumerators(conditionId, i) / den;
            }
        }
    }

    /// @dev Resolve a DePrize to its condition id and per-outcome-slot position
    ///      ids (slot i = `registry.teamIds(deprizeId)[i]`, the M3 convention).
    function _positions(uint256 deprizeId) private view returns (bytes32 conditionId, uint256[] memory positionIds) {
        IDePrizeRegistry.DePrize memory dp = registry.getDePrize(deprizeId);
        if (dp.state == IDePrizeRegistry.DePrizeState.NONE) revert UnknownDePrize(deprizeId);
        conditionId = dp.ctfConditionId;

        // The payout vector lives on the CTF and is indexed by the condition's
        // outcome slots. Trusting `teamIds.length` alone would silently under-pay
        // (skip real positions) or revert deep in `payoutNumerators` if the
        // registry ever diverges from the on-chain condition, so assert they
        // agree up front and fail loudly on inconsistent provisioning.
        uint256 n = dp.teamIds.length;
        uint256 slots = ctf.getOutcomeSlotCount(conditionId);
        if (n != slots) revert SlotCountMismatch(deprizeId, n, slots);

        positionIds = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            positionIds[i] = ctf.getPositionId(address(weth), ctf.getCollectionId(bytes32(0), conditionId, 1 << i));
        }
    }

    // ---------------------------------------------------------------------
    // ERC-1155 receiver (only accepts the mid-redeem pull from the CTF)
    // ---------------------------------------------------------------------

    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external view override returns (bytes4) {
        if (!_inRedeem || msg.sender != address(ctf)) revert UnexpectedERC1155();
        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata)
        external
        view
        override
        returns (bytes4)
    {
        if (!_inRedeem || msg.sender != address(ctf)) revert UnexpectedERC1155();
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == type(IERC1155Receiver).interfaceId || interfaceId == type(IERC165).interfaceId;
    }

    /// @dev Accepts ETH from `weth.withdraw` during a redemption.
    receive() external payable {}
}
