// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import {IJBTerminal} from "@nana-core-v5/interfaces/IJBTerminal.sol";
import {JBConstants} from "@nana-core-v5/libraries/JBConstants.sol";

import {IDePrizeRegistry} from "./IDePrizeRegistry.sol";
import {ILMSRWithTWAP} from "./interfaces/ILMSRWithTWAP.sol";
import {IConditionalTokens} from "./interfaces/IConditionalTokens.sol";
import {IWETH} from "./interfaces/IWETH.sol";

/// @title DePrizeMint
/// @notice The DePrize "bet router". A single `bet` call:
///         1. splits the incoming ETH into a 5% prize slice and 95% collateral;
///         2. pays the 5% slice into the DePrize's Juicebox project, so the bettor
///            receives $OVERVIEW (the cash-out floor) for that portion;
///         3. wraps the 95% to WETH and buys the chosen team's outcome tokens on
///            the team's Gnosis CTF + LMSRWithTWAP market;
///         4. forwards the minted ERC-1155 outcome tokens to the bettor and refunds
///            any unspent ETH.
///
/// @dev The CTF + LMSR market are externally-deployed Solidity 0.5 contracts; this
///      0.8 contract only calls them through interfaces. Betting is gated by the
///      DePrizeRegistry lifecycle (`bettingOpen`). Resolution (reportPayouts),
///      redemption, and refunds on terminal states are a later milestone (M4).
///
///      Outcome-slot convention: `outcomeIndex` is the position of the team in
///      `registry.teamIds(deprizeId)`.
contract DePrizeMint is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable,
    IERC1155Receiver
{
    /// @notice Prize slice numerator/denominator: 5% (1/20).
    uint256 public constant SLICE_DENOMINATOR = 20;

    IDePrizeRegistry public registry;
    IJBTerminal public jbTerminal;
    IWETH public weth;
    IConditionalTokens public ctf;

    /// @notice deprizeId => LMSRWithTWAP market address.
    mapping(uint256 => address) public marketOf;

    // Transient bet bookkeeping: outcome tokens minted to this contract during a
    // trade are captured in the ERC-1155 receiver hooks, then forwarded to the
    // bettor once the trade returns.
    bool private _inBet;
    uint256[] private _rcvIds;
    uint256[] private _rcvValues;

    /// @dev Storage gap for future upgrades (50 slots - 8 used = 42).
    uint256[42] private __gap;

    event MarketSet(uint256 indexed deprizeId, address indexed market);
    event Bet(
        uint256 indexed deprizeId,
        address indexed bettor,
        uint256 outcomeIndex,
        uint256 outcomeTokenAmount,
        uint256 cost,
        uint256 slice
    );

    error BettingClosed(uint256 deprizeId);
    error MarketNotSet(uint256 deprizeId);
    error BadOutcomeIndex(uint256 deprizeId, uint256 outcomeIndex);
    error NonPositiveCost();
    error CostTooHigh(uint256 cost, uint256 budget, uint256 maxCost);
    error RefundFailed();
    error ZeroMarket();
    error MarketCtfMismatch();
    error MarketCollateralMismatch();
    error MarketSlotMismatch(uint256 slots, uint256 teams);
    error MarketConditionMismatch(bytes32 marketCondition, bytes32 registryCondition);
    error UnexpectedERC1155();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address owner_, address registry_, address jbTerminal_, address weth_, address ctf_)
        external
        initializer
    {
        __Ownable_init(owner_);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        registry = IDePrizeRegistry(registry_);
        jbTerminal = IJBTerminal(jbTerminal_);
        weth = IWETH(weth_);
        ctf = IConditionalTokens(ctf_);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // ---------------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------------

    /// @notice Bind a DePrize to its LMSRWithTWAP market. Validates that the market
    ///         settles against the configured CTF + WETH, that its outcome-slot
    ///         count matches the DePrize's team count, and that the market's condition
    ///         ID matches the registry's stored condition ID.
    function setMarket(uint256 deprizeId, address market) external onlyOwner {
        if (market == address(0)) revert ZeroMarket();
        if (ILMSRWithTWAP(market).pmSystem() != address(ctf)) revert MarketCtfMismatch();
        if (ILMSRWithTWAP(market).collateralToken() != address(weth)) revert MarketCollateralMismatch();
        uint256 teams = registry.teamIds(deprizeId).length;
        uint256 slots = ILMSRWithTWAP(market).atomicOutcomeSlotCount();
        if (slots != teams) revert MarketSlotMismatch(slots, teams);
        bytes32 marketCondition = ILMSRWithTWAP(market).conditionIds(0);
        bytes32 registryCondition = registry.getDePrize(deprizeId).ctfConditionId;
        if (marketCondition != registryCondition) {
            revert MarketConditionMismatch(marketCondition, registryCondition);
        }
        marketOf[deprizeId] = market;
        emit MarketSet(deprizeId, market);
    }

    // ---------------------------------------------------------------------
    // Betting
    // ---------------------------------------------------------------------

    /// @notice Place a bet on `outcomeIndex` for `deprizeId`, buying exactly
    ///         `outcomeTokenAmount` outcome tokens (cost capped by `maxCost`).
    /// @dev The bettor specifies a token quantity (the frontend derives it from a
    ///      desired ETH amount via `calcNetCost`); unspent ETH is refunded. msg.value
    ///      must cover the 5% slice plus the trade cost.
    function bet(uint256 deprizeId, uint256 outcomeIndex, uint256 outcomeTokenAmount, uint256 maxCost)
        external
        payable
        nonReentrant
    {
        if (!registry.bettingOpen(deprizeId)) revert BettingClosed(deprizeId);

        uint256[] memory teams = registry.teamIds(deprizeId);
        if (outcomeIndex >= teams.length) revert BadOutcomeIndex(deprizeId, outcomeIndex);

        address market = marketOf[deprizeId];
        if (market == address(0)) revert MarketNotSet(deprizeId);

        uint256 slice = msg.value / SLICE_DENOMINATOR; // 5%
        uint256 budget = msg.value - slice; // 95%

        // 1. Prize slice -> Juicebox; bettor is the beneficiary (receives $OVERVIEW).
        jbTerminal.pay{value: slice}(
            registry.getDePrize(deprizeId).jbProjectId,
            JBConstants.NATIVE_TOKEN,
            slice,
            msg.sender,
            0,
            "DePrize bet",
            ""
        );

        // 2. Price the trade. `calcNetCost` is the outcome-token net cost EXCLUDING
        //    the market-maker fee; MarketMaker.trade pulls `netCost + calcMarketFee(netCost)`
        //    and checks that fee-inclusive total against `collateralLimit`. We compute
        //    the same total (calcMarketFee uses identical integer math) and cap on it.
        ILMSRWithTWAP market_ = ILMSRWithTWAP(market);
        int256[] memory amounts = new int256[](teams.length);
        amounts[outcomeIndex] = int256(outcomeTokenAmount);
        int256 net = market_.calcNetCost(amounts);
        if (net <= 0) revert NonPositiveCost();
        uint256 cost = uint256(net) + market_.calcMarketFee(uint256(net));
        if (cost > budget || cost > maxCost) revert CostTooHigh(cost, budget, maxCost);

        // 3. Wrap collateral and buy outcome tokens. We update TWAP then call `trade`
        //    DIRECTLY: `tradeWithTWAP` internally does `this.trade(...)`, which would
        //    make the market (not this router) the trader, so collateral/outcome-token
        //    flows would be misattributed. Minted ERC-1155 tokens land on this contract
        //    and are captured by the receiver hooks below.
        weth.deposit{value: cost}();
        weth.approve(market, cost);
        _inBet = true;
        market_.updateCumulativeTWAP();
        market_.trade(amounts, int256(cost));
        _inBet = false;

        // Defensive: sweep any collateral the trade didn't consume back to ETH so it
        // is returned to the bettor rather than stranded in the router.
        uint256 residualWeth = weth.balanceOf(address(this));
        if (residualWeth > 0) {
            weth.approve(market, 0);
            weth.withdraw(residualWeth);
        }

        // 4. Forward outcome tokens to the bettor and refund any unspent ETH.
        _flushOutcomeTokens(msg.sender);

        uint256 leftover = budget - cost + residualWeth;
        if (leftover > 0) {
            (bool ok,) = msg.sender.call{value: leftover}("");
            if (!ok) revert RefundFailed();
        }

        emit Bet(deprizeId, msg.sender, outcomeIndex, outcomeTokenAmount, cost, slice);
    }

    function _flushOutcomeTokens(address to) private {
        uint256 n = _rcvIds.length;
        if (n == 0) return;
        uint256[] memory ids = _rcvIds;
        uint256[] memory values = _rcvValues;
        delete _rcvIds;
        delete _rcvValues;
        ctf.safeBatchTransferFrom(address(this), to, ids, values, "");
    }

    // ---------------------------------------------------------------------
    // ERC-1155 receiver (only accepts CTF outcome tokens mid-bet)
    // ---------------------------------------------------------------------

    function onERC1155Received(address, address, uint256 id, uint256 value, bytes calldata)
        external
        override
        returns (bytes4)
    {
        if (!_inBet || msg.sender != address(ctf)) revert UnexpectedERC1155();
        _rcvIds.push(id);
        _rcvValues.push(value);
        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata ids,
        uint256[] calldata values,
        bytes calldata
    ) external override returns (bytes4) {
        if (!_inBet || msg.sender != address(ctf)) revert UnexpectedERC1155();
        for (uint256 i = 0; i < ids.length; i++) {
            _rcvIds.push(ids[i]);
            _rcvValues.push(values[i]);
        }
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == type(IERC1155Receiver).interfaceId || interfaceId == type(IERC165).interfaceId;
    }

    /// @dev Accepts ETH from `weth.withdraw` when sweeping unconsumed collateral.
    receive() external payable {}
}
