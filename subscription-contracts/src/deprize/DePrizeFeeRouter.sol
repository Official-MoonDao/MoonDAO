// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IJBTerminal} from "@nana-core-v5/interfaces/IJBTerminal.sol";
import {JBConstants} from "@nana-core-v5/libraries/JBConstants.sol";

import {IDePrizeRegistry} from "./IDePrizeRegistry.sol";
import {IDePrizeFeeRouter} from "./interfaces/IDePrizeFeeRouter.sol";
import {ILMSRWithTWAP} from "./interfaces/ILMSRWithTWAP.sol";
import {IConditionalTokens} from "./interfaces/IConditionalTokens.sol";
import {IWETH} from "./interfaces/IWETH.sol";

/// @title DePrizeFeeRouter
/// @notice Owns a DePrize's LMSRWithTWAP market and routes the market's accrued
///         1% trade fees into the DePrize's Juicebox prize pool, so the prize
///         grows with trading volume (buys AND sells), not just the 5% bet slice.
///
///         Why ownership: the Gnosis `MarketMaker.withdrawFees()` transfers the
///         market's standalone collateral balance to `owner()`. While the market
///         is Running/Paused that balance is exactly the accumulated fees (trade
///         collateral is escrowed inside the CTF via splitPosition, and the
///         funding seed likewise), so sweeping mid-campaign is safe and does not
///         move prices. Making this contract the market owner is what lets
///         `sweepFees` be permissionless and automatic.
///
///         Routing policy:
///         - While the DePrize is live (NOT terminal AND no cancellation notice
///           pending): fees -> `jbTerminal.pay` into the DePrize's Juicebox
///           project (the prize pool). $OVERVIEW minted for the payment goes to
///           the treasury (`owner()`), since fees have no single attributable
///           bettor.
///         - Once the DePrize IS terminal OR a cancellation notice is pending:
///           fees -> `owner()` (treasury). On refundable terminals (and during
///           the 7-day cancel notice that precedes CANCELLED), topping up the
///           JB pot would silently inflate the $OVERVIEW cash-out floor and
///           distort the disclosed refund; on M2_COMPLETE the prize has already
///           been disbursed.
///
///         The M4 unwind still works, via the owner passthroughs below: the Safe
///         (this contract's owner) pauses/closes the market through this contract
///         and recovers the closed market's outcome-token inventory with
///         {recoverERC1155}.
///
/// @dev Non-upgradeable by design (same rationale as DePrizeRedeem): no state
///      worth migrating, and the owner can always exit by calling
///      {transferMarketOwnership} to repoint the market at a new router or the
///      Safe itself.
contract DePrizeFeeRouter is Ownable, ReentrancyGuard, IERC1155Receiver, IDePrizeFeeRouter {
    IDePrizeRegistry public immutable registry;
    IJBTerminal public immutable jbTerminal;
    IWETH public immutable weth;
    IConditionalTokens public immutable ctf;

    /// @notice deprizeId => LMSRWithTWAP market this router sweeps (and owns).
    mapping(uint256 => address) public marketOf;

    /// @dev True only while {closeMarket} runs; gates the ERC-1155 acceptance
    ///      hooks so the closed market's inventory push is accepted but
    ///      unsolicited deposits revert.
    bool private _inClose;

    event MarketSet(uint256 indexed deprizeId, address indexed market);
    event FeesSwept(uint256 indexed deprizeId, uint256 amount, bool indexed toPrizePool);

    error ZeroAddress();
    error ZeroMarket();
    error MarketNotSet(uint256 deprizeId);
    error MarketCtfMismatch();
    error MarketCollateralMismatch();
    error MarketConditionMismatch(bytes32 marketCondition, bytes32 registryCondition);
    error UnexpectedERC1155();
    error EthTransferFailed();

    constructor(address owner_, address registry_, address jbTerminal_, address weth_, address ctf_)
        Ownable(owner_)
    {
        if (registry_ == address(0) || jbTerminal_ == address(0) || weth_ == address(0) || ctf_ == address(0)) {
            revert ZeroAddress();
        }
        registry = IDePrizeRegistry(registry_);
        jbTerminal = IJBTerminal(jbTerminal_);
        weth = IWETH(weth_);
        ctf = IConditionalTokens(ctf_);
    }

    // ---------------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------------

    /// @notice Bind a DePrize to the market this router sweeps. Validates the
    ///         market settles against the configured CTF + WETH and matches the
    ///         registry's condition (same checks as DePrizeMint.setMarket).
    ///         The market's LMSR ownership must ALSO be transferred to this
    ///         contract for {sweepFees} to work (withdrawFees is onlyOwner).
    function setMarket(uint256 deprizeId, address market) external onlyOwner {
        if (market == address(0)) revert ZeroMarket();
        if (ILMSRWithTWAP(market).pmSystem() != address(ctf)) revert MarketCtfMismatch();
        if (ILMSRWithTWAP(market).collateralToken() != address(weth)) revert MarketCollateralMismatch();
        bytes32 marketCondition = ILMSRWithTWAP(market).conditionIds(0);
        bytes32 registryCondition = registry.getDePrize(deprizeId).ctfConditionId;
        if (marketCondition != registryCondition) {
            revert MarketConditionMismatch(marketCondition, registryCondition);
        }
        marketOf[deprizeId] = market;
        emit MarketSet(deprizeId, market);
    }

    // ---------------------------------------------------------------------
    // Fee sweeping
    // ---------------------------------------------------------------------

    /// @inheritdoc IDePrizeFeeRouter
    /// @dev Measures the WETH actually received (balance delta) rather than
    ///      trusting the market's return value, so stray WETH parked in the
    ///      market can never over-credit and stray WETH in this contract is
    ///      never swept into the prize pool.
    function sweepFees(uint256 deprizeId) external nonReentrant returns (uint256 swept) {
        address market = marketOf[deprizeId];
        if (market == address(0)) revert MarketNotSet(deprizeId);

        uint256 before = weth.balanceOf(address(this));
        ILMSRWithTWAP(market).withdrawFees();
        swept = weth.balanceOf(address(this)) - before;
        if (swept == 0) return 0;

        weth.withdraw(swept);

        // Cancellation notice leaves the DePrize non-terminal (often still OPEN)
        // while betting is already closed and sells can still accrue LMSR fees.
        // Route those to treasury so the pending refund path cannot inflate the
        // $OVERVIEW cash-out floor via trade-fee top-ups (same guard as terminal).
        bool toPrizePool =
            !registry.isTerminal(deprizeId) && !registry.cancellationPending(deprizeId);
        if (toPrizePool) {
            jbTerminal.pay{value: swept}(
                registry.getDePrize(deprizeId).jbProjectId,
                JBConstants.NATIVE_TOKEN,
                swept,
                owner(),
                0,
                "DePrize trade fees",
                ""
            );
        } else {
            (bool ok,) = owner().call{value: swept}("");
            if (!ok) revert EthTransferFailed();
        }
        emit FeesSwept(deprizeId, swept, toPrizePool);
    }

    // ---------------------------------------------------------------------
    // Market owner passthroughs (the Safe operates the market through here,
    // since the LMSR's onlyOwner surface now sees this contract as owner)
    // ---------------------------------------------------------------------

    function pauseMarket(uint256 deprizeId) external onlyOwner {
        ILMSRWithTWAP(_market(deprizeId)).pause();
    }

    function resumeMarket(uint256 deprizeId) external onlyOwner {
        ILMSRWithTWAP(_market(deprizeId)).resume();
    }

    /// @notice Close the market (M4 unwind). The LMSR pushes its remaining
    ///         outcome-token inventory to this contract; recover it to the Safe
    ///         with {recoverERC1155} for CTF redemption after reportPayouts.
    function closeMarket(uint256 deprizeId) external onlyOwner {
        _inClose = true;
        ILMSRWithTWAP(_market(deprizeId)).close();
        _inClose = false;
    }

    /// @notice Escape hatch: hand the market's LMSR ownership to a new owner
    ///         (a replacement router, or the Safe directly).
    function transferMarketOwnership(uint256 deprizeId, address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        ILMSRWithTWAP(_market(deprizeId)).transferOwnership(newOwner);
    }

    // ---------------------------------------------------------------------
    // Recovery (onlyOwner)
    // ---------------------------------------------------------------------

    /// @notice Forward CTF outcome tokens held by this contract (the closed
    ///         market's inventory) to `to` — typically the Safe, which redeems
    ///         them on the CTF after resolution.
    function recoverERC1155(uint256[] calldata ids, uint256[] calldata values, address to) external onlyOwner {
        ctf.safeBatchTransferFrom(address(this), to, ids, values, "");
    }

    function recoverERC20(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).transfer(to, amount);
    }

    function recoverETH(address to, uint256 amount) external onlyOwner {
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert EthTransferFailed();
    }

    // ---------------------------------------------------------------------
    // ERC-1155 receiver (only accepts the CTF's inventory push mid-close)
    // ---------------------------------------------------------------------

    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external view returns (bytes4) {
        if (!_inClose || msg.sender != address(ctf)) revert UnexpectedERC1155();
        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata)
        external
        view
        returns (bytes4)
    {
        if (!_inClose || msg.sender != address(ctf)) revert UnexpectedERC1155();
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IERC1155Receiver).interfaceId || interfaceId == type(IERC165).interfaceId;
    }

    function _market(uint256 deprizeId) private view returns (address market) {
        market = marketOf[deprizeId];
        if (market == address(0)) revert MarketNotSet(deprizeId);
    }

    /// @dev Accepts ETH from `weth.withdraw` during sweeps.
    receive() external payable {}
}
