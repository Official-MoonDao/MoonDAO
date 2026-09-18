// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import {IJBTerminal} from "@nana-core-v5/interfaces/IJBTerminal.sol";
import {JBConstants} from "@nana-core-v5/libraries/JBConstants.sol";

import {IDePrizeRegistry} from "./IDePrizeRegistry.sol";
import {ILMSRMarketMaker} from "./interfaces/ILMSRMarketMaker.sol";
import {IConditionalTokens} from "./interfaces/IConditionalTokens.sol";
import {IWETH} from "./interfaces/IWETH.sol";

/// @title DePrizeMint
/// @notice The DePrize bet router. One `bet` call:
///         1. verifies a backend `CompliancePermit` for `msg.sender`;
///         2. splits the ETH into a 5% prize slice and a 95% budget;
///         3. pays the slice into the DePrize's Juicebox project (bettor is the
///            beneficiary and receives that mission's project token);
///         4. wraps exactly the quoted cost to WETH and buys `outcomeTokenAmount`
///            of one outcome on the unmodified Gnosis LMSR market;
///         5. forwards the ERC-1155 outcome tokens to the bettor and refunds the
///            unspent budget.
///
/// @dev Immutable and non-upgradeable. The only mutable admin knob is
///      `complianceSigner`; `setMarket` is write-once per DePrize. Every branch
///      fails closed: a cost or token mismatch reverts the whole bet rather than
///      sweeping residuals. The contract never intentionally holds ETH, WETH or
///      outcome tokens after a call returns.
///
///      Outcome-slot convention: `outcomeIndex` is the team's position in
///      `registry.teamIds(deprizeId)`; single-condition market, parent
///      collection `bytes32(0)` (same as DePrizeRedeem).
contract DePrizeMint is Ownable2Step, ReentrancyGuard, EIP712, IERC1155Receiver {
    using SafeERC20 for IERC20;

    /// @notice Prize slice: 5% (1/20) of msg.value.
    uint256 public constant SLICE_DENOMINATOR = 20;

    bytes32 public constant COMPLIANCE_PERMIT_TYPEHASH =
        keccak256("CompliancePermit(address wallet,uint256 deprizeId,uint256 deadline)");

    IDePrizeRegistry public immutable registry;
    IJBTerminal public immutable jbTerminal;
    IWETH public immutable weth;
    IConditionalTokens public immutable ctf;

    /// @notice deprizeId => LMSR market. Write-once.
    mapping(uint256 => address) public marketOf;

    /// @notice Backend key that must sign a `CompliancePermit` for each bet.
    ///         `address(0)` rejects every bet — there is no unsigned path.
    address public complianceSigner;

    // Transient bet bookkeeping: Gnosis `trade` pushes the bought outcome tokens
    // to this contract as one ERC-1155 batch over every position id (zero for
    // slots not bought). The hooks accept only the expected id while `_inBet`
    // is set and `bet` forwards exactly that amount before returning.
    bool private _inBet;
    uint256 private _expectedPositionId;
    uint256 private _received;

    event MarketSet(uint256 indexed deprizeId, address indexed market);
    event ComplianceSignerSet(address indexed complianceSigner);
    event Bet(
        uint256 indexed deprizeId,
        address indexed bettor,
        uint256 outcomeIndex,
        uint256 outcomeTokenAmount,
        uint256 cost,
        uint256 slice
    );

    error ZeroAddress();
    error BettingClosed(uint256 deprizeId);
    error MarketNotSet(uint256 deprizeId);
    error MarketAlreadySet(uint256 deprizeId, address market);
    error BadOutcomeIndex(uint256 deprizeId, uint256 outcomeIndex);
    error NonPositiveCost();
    error CostTooHigh(uint256 cost, uint256 budget, uint256 maxCost);
    error CollateralMismatch(uint256 expectedSpent, uint256 actualSpent);
    error OutcomeTokenMismatch(uint256 expectedPositionId, uint256 expectedAmount, uint256 received);
    error RefundFailed();
    error MarketCtfMismatch();
    error MarketCollateralMismatch();
    error MarketSlotMismatch(uint256 slots, uint256 teams);
    error MarketConditionMismatch(bytes32 marketCondition, bytes32 registryCondition);
    error UnexpectedERC1155();
    error ComplianceSignerUnset();
    error PermitExpired(uint256 deadline);
    error InvalidPermit(address recovered);
    error RenounceDisabled();

    constructor(address owner_, address registry_, address jbTerminal_, address weth_, address ctf_)
        Ownable(owner_)
        EIP712("DePrizeMint", "1")
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

    /// @dev An ownerless mint could never rotate the permit signer or bind a
    ///      market for a new generation. Ownership moves only via the two-step transfer.
    function renounceOwnership() public view override onlyOwner {
        revert RenounceDisabled();
    }

    /// @notice Bind a DePrize to its LMSR market, once. Validates that the market
    ///         settles against the configured CTF + WETH, that its outcome-slot
    ///         count matches the roster, and that its condition matches the registry.
    function setMarket(uint256 deprizeId, address market) external onlyOwner {
        if (market == address(0)) revert ZeroAddress();
        if (marketOf[deprizeId] != address(0)) revert MarketAlreadySet(deprizeId, marketOf[deprizeId]);

        ILMSRMarketMaker m = ILMSRMarketMaker(market);
        if (m.pmSystem() != address(ctf)) revert MarketCtfMismatch();
        if (m.collateralToken() != address(weth)) revert MarketCollateralMismatch();
        uint256 teams = registry.teamIds(deprizeId).length;
        uint256 slots = m.atomicOutcomeSlotCount();
        if (slots != teams) revert MarketSlotMismatch(slots, teams);
        bytes32 marketCondition = m.conditionIds(0);
        bytes32 registryCondition = registry.getDePrize(deprizeId).ctfConditionId;
        if (marketCondition != registryCondition) {
            revert MarketConditionMismatch(marketCondition, registryCondition);
        }

        marketOf[deprizeId] = market;
        emit MarketSet(deprizeId, market);
    }

    /// @notice Rotate the backend permit key. `address(0)` disables betting.
    function setComplianceSigner(address complianceSigner_) external onlyOwner {
        complianceSigner = complianceSigner_;
        emit ComplianceSignerSet(complianceSigner_);
    }

    /// @notice EIP-712 digest the backend signs for `wallet` + `deprizeId`.
    function hashPermit(address wallet, uint256 deprizeId, uint256 deadline) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(COMPLIANCE_PERMIT_TYPEHASH, wallet, deprizeId, deadline)));
    }

    // ---------------------------------------------------------------------
    // Betting
    // ---------------------------------------------------------------------

    /// @notice Buy exactly `outcomeTokenAmount` tokens of `outcomeIndex` for
    ///         `deprizeId`. `msg.value` must cover the 5% slice plus the
    ///         fee-inclusive trade cost; unspent budget is refunded.
    /// @param maxCost Fee-inclusive cost ceiling the bettor accepts (slippage guard).
    /// @param deadline Permit expiry.
    /// @param signature `CompliancePermit` from `complianceSigner` over
    ///        `(msg.sender, deprizeId, deadline)`.
    function bet(
        uint256 deprizeId,
        uint256 outcomeIndex,
        uint256 outcomeTokenAmount,
        uint256 maxCost,
        uint256 deadline,
        bytes calldata signature
    ) external payable nonReentrant {
        _verifyPermit(deprizeId, deadline, signature);
        if (!registry.bettingOpen(deprizeId)) revert BettingClosed(deprizeId);

        IDePrizeRegistry.DePrize memory dp = registry.getDePrize(deprizeId);
        uint256 slotCount = dp.teamIds.length;
        if (outcomeIndex >= slotCount) revert BadOutcomeIndex(deprizeId, outcomeIndex);

        address market = marketOf[deprizeId];
        if (market == address(0)) revert MarketNotSet(deprizeId);

        uint256 slice = msg.value / SLICE_DENOMINATOR;
        uint256 budget = msg.value - slice;

        // Price the trade. `calcNetCost` excludes the market fee; `trade` pulls
        // `net + calcMarketFee(net)` and checks that total against collateralLimit.
        ILMSRMarketMaker m = ILMSRMarketMaker(market);
        int256[] memory amounts = new int256[](slotCount);
        amounts[outcomeIndex] = int256(outcomeTokenAmount);
        int256 net = m.calcNetCost(amounts);
        if (net <= 0) revert NonPositiveCost();
        uint256 cost = uint256(net) + m.calcMarketFee(uint256(net));
        if (cost > budget || cost > maxCost) revert CostTooHigh(cost, budget, maxCost);

        // 1. Prize slice -> Juicebox; bettor receives the bound mission's project token.
        //    The returned token count is the mission's business, not the bet's.
        // slither-disable-next-line unused-return
        jbTerminal.pay{value: slice}(dp.jbProjectId, JBConstants.NATIVE_TOKEN, slice, msg.sender, 0, "DePrize bet", "");

        // 2. Wrap exactly `cost` and buy. The CTF pushes the outcome tokens to this
        //    contract; the hooks accept only `expectedPositionId` while `_inBet` is set.
        uint256 expectedPositionId = ctf.getPositionId(
            address(weth), ctf.getCollectionId(bytes32(0), dp.ctfConditionId, 1 << outcomeIndex)
        );
        //    The pre/post balance read is the whole point (fail closed on drift);
        //    `nonReentrant` plus the CTF-only receiver make the window inert. The
        //    `_inBet` / `_expectedPositionId` flags are read by the ERC-1155 hooks
        //    that `trade` triggers, then cleared.
        // slither-disable-start reentrancy-balance,write-after-write
        uint256 wethBefore = weth.balanceOf(address(this));
        weth.deposit{value: cost}();
        IERC20(address(weth)).forceApprove(market, cost);
        _expectedPositionId = expectedPositionId;
        _inBet = true;
        int256 charged = m.trade(amounts, int256(cost));
        _inBet = false;
        uint256 received = _received;
        _received = 0;
        _expectedPositionId = 0;

        // 3. Fail closed on any accounting drift instead of sweeping residuals:
        //    the market must report AND actually pull exactly `cost`.
        if (charged != int256(cost)) revert CollateralMismatch(cost, charged < 0 ? 0 : uint256(charged));
        uint256 spent = wethBefore + cost - weth.balanceOf(address(this));
        if (spent != cost) revert CollateralMismatch(cost, spent);
        // slither-disable-end reentrancy-balance,write-after-write
        if (received != outcomeTokenAmount) {
            revert OutcomeTokenMismatch(expectedPositionId, outcomeTokenAmount, received);
        }

        // 4. Forward the outcome tokens, then refund the unspent budget.
        ctf.safeTransferFrom(address(this), msg.sender, expectedPositionId, outcomeTokenAmount, "");

        uint256 leftover = budget - cost;
        if (leftover > 0) {
            (bool ok,) = msg.sender.call{value: leftover}("");
            if (!ok) revert RefundFailed();
        }

        emit Bet(deprizeId, msg.sender, outcomeIndex, outcomeTokenAmount, cost, slice);
    }

    function _verifyPermit(uint256 deprizeId, uint256 deadline, bytes calldata signature) internal view {
        address signer = complianceSigner;
        if (signer == address(0)) revert ComplianceSignerUnset();
        if (block.timestamp > deadline) revert PermitExpired(deadline);
        address recovered = ECDSA.recover(hashPermit(msg.sender, deprizeId, deadline), signature);
        if (recovered != signer) revert InvalidPermit(recovered);
    }

    // ---------------------------------------------------------------------
    // ERC-1155 receiver: only the CTF, only mid-bet, only the expected position
    // ---------------------------------------------------------------------

    function _accept(uint256 id, uint256 value) private {
        if (!_inBet || msg.sender != address(ctf)) revert UnexpectedERC1155();
        if (value == 0) return;
        if (id != _expectedPositionId) revert UnexpectedERC1155();
        _received += value;
    }

    function onERC1155Received(address, address, uint256 id, uint256 value, bytes calldata)
        external
        override
        returns (bytes4)
    {
        _accept(id, value);
        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata ids,
        uint256[] calldata values,
        bytes calldata
    ) external override returns (bytes4) {
        if (ids.length != values.length) revert UnexpectedERC1155();
        for (uint256 i = 0; i < ids.length; i++) {
            _accept(ids[i], values[i]);
        }
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == type(IERC1155Receiver).interfaceId || interfaceId == type(IERC165).interfaceId;
    }
}
