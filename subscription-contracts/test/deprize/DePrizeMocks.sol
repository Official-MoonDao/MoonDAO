// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/// @dev Shared DePrize v2 test doubles. Every mock mirrors the *observable*
///      behaviour of the real dependency the glue talks to (Juicebox terminal,
///      WETH9, Gnosis ConditionalTokens, Gnosis LMSRMarketMaker) so the same
///      assertions hold against the fork suite.

/// @dev Records the 5% prize-slice routing. Signature matches IJBTerminal.pay.
contract MockJBTerminal {
    uint256 public lastProjectId;
    address public lastBeneficiary;
    uint256 public lastValue;
    uint256 public totalReceived;
    uint256 public payCount;

    function pay(
        uint256 projectId,
        address,
        uint256,
        address beneficiary,
        uint256,
        string calldata,
        bytes calldata
    ) external payable returns (uint256) {
        lastProjectId = projectId;
        lastBeneficiary = beneficiary;
        lastValue = msg.value;
        totalReceived += msg.value;
        payCount++;
        return msg.value;
    }

    receive() external payable {}
}

/// @dev Minimal WETH9-style wrapper.
contract MockWETH {
    string public name = "Wrapped Ether";
    string public symbol = "WETH";
    uint8 public decimals = 18;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function deposit() external payable {
        balanceOf[msg.sender] += msg.value;
    }

    function withdraw(uint256 amount) external {
        balanceOf[msg.sender] -= amount;
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "withdraw failed");
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function totalSupply() external pure returns (uint256) {
        return 0;
    }

    receive() external payable {
        balanceOf[msg.sender] += msg.value;
    }
}

/// @dev Resolution-capable ConditionalTokens mock, faithful to the deployed 0.5
///      Gnosis source: conditionId derived from msg.sender in reportPayouts,
///      write-once payout vector (denominator 0 -> sum), per-position floor
///      division in redeemPositions, burn-on-redeem, ERC-1155 approval checks
///      and acceptance hooks on transfers to contracts.
contract MockResolvingCTF {
    mapping(uint256 => mapping(address => uint256)) public balances;
    mapping(address => mapping(address => bool)) public approvals;
    mapping(bytes32 => uint256[]) private _payoutNumerators;
    mapping(bytes32 => uint256) public payoutDenominator;
    address public collateral;

    constructor(address collateral_) {
        collateral = collateral_;
    }

    // -- conditions & resolution -------------------------------------------

    function prepareCondition(address oracle, bytes32 questionId, uint256 outcomeSlotCount) external {
        require(outcomeSlotCount > 1, "there should be more than one outcome slot");
        bytes32 conditionId = getConditionId(oracle, questionId, outcomeSlotCount);
        require(_payoutNumerators[conditionId].length == 0, "condition already prepared");
        _payoutNumerators[conditionId] = new uint256[](outcomeSlotCount);
    }

    function reportPayouts(bytes32 questionId, uint256[] calldata payouts) external {
        uint256 outcomeSlotCount = payouts.length;
        require(outcomeSlotCount > 1, "there should be more than one outcome slot");
        bytes32 conditionId = getConditionId(msg.sender, questionId, outcomeSlotCount);
        require(_payoutNumerators[conditionId].length == outcomeSlotCount, "condition not prepared or found");
        require(payoutDenominator[conditionId] == 0, "payout denominator already set");
        uint256 den = 0;
        for (uint256 i = 0; i < outcomeSlotCount; i++) {
            den += payouts[i];
            require(_payoutNumerators[conditionId][i] == 0, "payout numerator already set");
            _payoutNumerators[conditionId][i] = payouts[i];
        }
        require(den > 0, "payout is all zeroes");
        payoutDenominator[conditionId] = den;
    }

    function redeemPositions(
        address collateralToken,
        bytes32 parentCollectionId,
        bytes32 conditionId,
        uint256[] calldata indexSets
    ) external {
        require(parentCollectionId == bytes32(0), "mock supports root positions only");
        uint256 den = payoutDenominator[conditionId];
        require(den > 0, "result for condition not received yet");
        uint256 outcomeSlotCount = _payoutNumerators[conditionId].length;
        require(outcomeSlotCount > 0, "condition not prepared yet");

        uint256 totalPayout = 0;
        uint256 fullIndexSet = (1 << outcomeSlotCount) - 1;
        for (uint256 i = 0; i < indexSets.length; i++) {
            uint256 indexSet = indexSets[i];
            require(indexSet > 0 && indexSet < fullIndexSet, "got invalid index set");
            uint256 positionId = getPositionId(collateralToken, getCollectionId(parentCollectionId, conditionId, indexSet));
            uint256 payoutNumerator = 0;
            for (uint256 j = 0; j < outcomeSlotCount; j++) {
                if (indexSet & (1 << j) != 0) payoutNumerator += _payoutNumerators[conditionId][j];
            }
            uint256 stake = balances[positionId][msg.sender];
            if (stake > 0) {
                totalPayout += stake * payoutNumerator / den;
                balances[positionId][msg.sender] = 0;
            }
        }
        if (totalPayout > 0) {
            require(MockWETH(payable(collateralToken)).transfer(msg.sender, totalPayout), "payout transfer failed");
        }
    }

    function payoutNumerators(bytes32 conditionId, uint256 index) external view returns (uint256) {
        return _payoutNumerators[conditionId][index];
    }

    function getOutcomeSlotCount(bytes32 conditionId) external view returns (uint256) {
        return _payoutNumerators[conditionId].length;
    }

    // -- id helpers (mirror CTHelpers) ---------------------------------------

    function getConditionId(address oracle, bytes32 questionId, uint256 outcomeSlotCount)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(oracle, questionId, outcomeSlotCount));
    }

    function getCollectionId(bytes32 parentCollectionId, bytes32 conditionId, uint256 indexSet)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(parentCollectionId, conditionId, indexSet));
    }

    function getPositionId(address collateralToken, bytes32 collectionId) public pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(collateralToken, collectionId)));
    }

    // -- ERC-1155 surface ----------------------------------------------------

    function balanceOf(address owner, uint256 id) external view returns (uint256) {
        return balances[id][owner];
    }

    function balanceOfBatch(address[] calldata owners, uint256[] calldata ids)
        external
        view
        returns (uint256[] memory out)
    {
        out = new uint256[](owners.length);
        for (uint256 i = 0; i < owners.length; i++) {
            out[i] = balances[ids[i]][owners[i]];
        }
    }

    function setApprovalForAll(address operator, bool approved) external {
        approvals[msg.sender][operator] = approved;
    }

    function isApprovedForAll(address owner, address operator) external view returns (bool) {
        return approvals[owner][operator];
    }

    function safeTransferFrom(address from, address to, uint256 id, uint256 value, bytes calldata) external {
        require(from == msg.sender || approvals[from][msg.sender], "ERC1155: caller not approved");
        balances[id][from] -= value;
        balances[id][to] += value;
        _acceptSingle(to, from, id, value);
    }

    /// @dev Test knob: deliver batch transfers through the SINGLE acceptance hook per id.
    bool public useSingleHooks;

    function setUseSingleHooks(bool v) external {
        useSingleHooks = v;
    }

    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] calldata ids,
        uint256[] calldata values,
        bytes calldata
    ) external {
        require(from == msg.sender || approvals[from][msg.sender], "ERC1155: caller not approved");
        for (uint256 i = 0; i < ids.length; i++) {
            balances[ids[i]][from] -= values[i];
            balances[ids[i]][to] += values[i];
        }
        if (to.code.length > 0) {
            if (useSingleHooks) {
                for (uint256 i = 0; i < ids.length; i++) {
                    _acceptSingle(to, from, ids[i], values[i]);
                }
            } else {
                bytes4 ret = IERC1155Receiver(to).onERC1155BatchReceived(msg.sender, from, ids, values, "");
                require(ret == IERC1155Receiver.onERC1155BatchReceived.selector, "1155 rejected");
            }
        }
    }

    function _acceptSingle(address to, address from, uint256 id, uint256 value) private {
        if (to.code.length > 0) {
            bytes4 ret = IERC1155Receiver(to).onERC1155Received(msg.sender, from, id, value, "");
            require(ret == IERC1155Receiver.onERC1155Received.selector, "1155 rejected");
        }
    }

    /// @dev Test helper: mint outcome tokens directly (stands in for splitPosition).
    function mint(address to, uint256 id, uint256 value) external {
        balances[id][to] += value;
    }
}

/// @dev Stock-Gnosis `LMSRMarketMaker` stand-in with linear pricing
///      (cost = qty * price / 1e18). Faithful to `MarketMaker.trade`: pulls
///      `netCost + fee` from the trader, delivers each bought slot through a
///      SINGLE `safeTransferFrom` (so the receiver sees `onERC1155Received`),
///      pulls sold tokens back and pays `gross - fee`. Owner surface mirrors the
///      real one (pause/resume/close/withdrawFees/transferOwnership).
///
///      Test knobs (all default off) let DePrizeMint tests exercise fail-closed
///      branches that a real market can never produce.
contract MockLMSR is IERC1155Receiver {
    MockResolvingCTF public immutable ctfC;
    MockWETH public immutable wethC;
    uint256 public immutable slots;
    uint256 public price; // WETH per outcome token, 1e18 fixed point
    bytes32 public condition;
    address public owner;
    uint8 private _stage; // 0 Running, 1 Paused, 2 Closed
    uint64 private _fee = 1e16; // 1%
    uint256 public funding;

    // Fees the market has kept (standalone WETH == this in the real market).
    uint256 public accruedFees;

    // Knobs
    uint256 public underpull; // leave this much collateral unconsumed
    bool public skipDeliver; // pull collateral, deliver nothing
    bool public deliverWrongSlot; // deliver the neighbouring slot's token
    bool public deliverSingle; // one safeTransferFrom per bought slot instead of the real full batch
    bool public overDeliver; // deliver amount + 1

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor(address ctf_, address weth_, uint256 slots_, uint256 price_, bytes32 condition_) {
        ctfC = MockResolvingCTF(ctf_);
        wethC = MockWETH(payable(weth_));
        slots = slots_;
        price = price_;
        condition = condition_;
        owner = msg.sender;
    }

    // -- knobs ---------------------------------------------------------------

    function setPrice(uint256 p) external {
        price = p;
    }

    function setFee(uint64 f) external {
        _fee = f;
    }

    function setCondition(bytes32 c) external {
        condition = c;
    }

    function setUnderpull(uint256 u) external {
        underpull = u;
    }

    function setSkipDeliver(bool v) external {
        skipDeliver = v;
    }

    function setDeliverWrongSlot(bool v) external {
        deliverWrongSlot = v;
    }

    function setDeliverSingle(bool v) external {
        deliverSingle = v;
    }

    function setOverDeliver(bool v) external {
        overDeliver = v;
    }

    // -- ILMSRMarketMaker views ---------------------------------------------

    function pmSystem() external view returns (address) {
        return address(ctfC);
    }

    function collateralToken() external view returns (address) {
        return address(wethC);
    }

    function atomicOutcomeSlotCount() external view returns (uint256) {
        return slots;
    }

    function conditionIds(uint256) external view returns (bytes32) {
        return condition;
    }

    function fee() public view returns (uint64) {
        return _fee;
    }

    function stage() external view returns (uint8) {
        return _stage;
    }

    function calcMarginalPrice(uint8) external view returns (uint256) {
        return price;
    }

    function calcNetCost(int256[] memory amounts) public view returns (int256 cost) {
        for (uint256 i = 0; i < amounts.length; i++) {
            cost += (amounts[i] * int256(price)) / 1e18;
        }
    }

    function calcMarketFee(uint256 outcomeTokenCost) public view returns (uint256) {
        return (outcomeTokenCost * uint256(fee())) / 1e18;
    }

    function positionId(uint256 i) public view returns (uint256) {
        return ctfC.getPositionId(address(wethC), ctfC.getCollectionId(bytes32(0), condition, 1 << i));
    }

    // -- trade -----------------------------------------------------------------

    function trade(int256[] memory amounts, int256 collateralLimit) external returns (int256 total) {
        require(_stage == 0, "market halted");
        require(amounts.length == slots, "bad amounts length");
        int256 net = calcNetCost(amounts);

        if (net > 0) {
            uint256 f = calcMarketFee(uint256(net));
            total = net + int256(f);
            require(total <= collateralLimit, "limit");
            wethC.transferFrom(msg.sender, address(this), uint256(total) - underpull);
            accruedFees += f;
            if (skipDeliver) return total;
            // Real MarketMaker.trade: ONE batch over every position id, zero for
            // slots not bought.
            uint256[] memory ids = new uint256[](slots);
            uint256[] memory vals = new uint256[](slots);
            for (uint256 i = 0; i < slots; i++) {
                ids[i] = positionId(i);
            }
            for (uint256 i = 0; i < amounts.length; i++) {
                if (amounts[i] <= 0) continue;
                uint256 slot = deliverWrongSlot ? (i + 1) % slots : i;
                uint256 amt = uint256(amounts[i]) + (overDeliver ? 1 : 0);
                ctfC.mint(address(this), ids[slot], amt);
                vals[slot] += amt;
            }
            if (deliverSingle) {
                for (uint256 i = 0; i < slots; i++) {
                    if (vals[i] != 0) ctfC.safeTransferFrom(address(this), msg.sender, ids[i], vals[i], "");
                }
            } else {
                ctfC.safeBatchTransferFrom(address(this), msg.sender, ids, vals, "");
            }
        } else {
            uint256 gross = uint256(-net);
            uint256 f = calcMarketFee(gross);
            total = net + int256(f);
            // Real MarketMaker: 0 == no limit, otherwise netCost <= collateralLimit.
            require(collateralLimit == 0 || total <= collateralLimit, "limit");
            for (uint256 i = 0; i < amounts.length; i++) {
                if (amounts[i] >= 0) continue;
                ctfC.safeTransferFrom(msg.sender, address(this), positionId(i), uint256(-amounts[i]), "");
            }
            accruedFees += f;
            require(wethC.transfer(msg.sender, gross - f), "payout failed");
        }
    }

    // -- owner surface ---------------------------------------------------------

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function pause() external onlyOwner {
        require(_stage == 0, "not running");
        _stage = 1;
    }

    function resume() external onlyOwner {
        require(_stage == 1, "not paused");
        _stage = 0;
    }

    function close() external onlyOwner {
        require(_stage != 2, "closed");
        _stage = 2;
    }

    /// @dev Real `withdrawFees` sends the market's whole standalone WETH balance.
    function withdrawFees() external onlyOwner returns (uint256 fees) {
        fees = wethC.balanceOf(address(this));
        accruedFees = 0;
        require(wethC.transfer(owner, fees), "fee transfer failed");
    }

    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external pure returns (bytes4) {
        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IERC1155Receiver).interfaceId || interfaceId == type(IERC165).interfaceId;
    }
}

/// @dev Minimal LMSR stub for the resolve script's market-halted check.
contract StubMarket {
    uint8 public stage;
    bytes32 internal _conditionId;

    constructor(bytes32 conditionId_) {
        _conditionId = conditionId_;
    }

    function setStage(uint8 s) external {
        stage = s;
    }

    function conditionIds(uint256) external view returns (bytes32) {
        return _conditionId;
    }
}
