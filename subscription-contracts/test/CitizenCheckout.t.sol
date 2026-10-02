// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {CitizenCheckout, ISwapRouter, IVotingEscrow} from "../src/CitizenCheckout.sol";
import {CheckoutOnlyMinter} from "../src/CheckoutOnlyMinter.sol";

contract MockERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
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
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract MockWETH is MockERC20 {
    function deposit() external payable {
        balanceOf[msg.sender] += msg.value;
    }
}

contract MockCitizen {
    uint256 public price;
    address public lastTo;
    uint256 public lastValue;
    address public tokenOwner = address(0xCAFE);

    function setPrice(uint256 price_) external {
        price = price_;
    }

    function setTokenOwner(address owner_) external {
        tokenOwner = owner_;
    }

    function getRenewalPrice(address, uint64) external view returns (uint256) {
        return price;
    }

    function ownerOf(uint256) external view returns (address) {
        return tokenOwner;
    }

    function mintTo(
        address to,
        string memory,
        string memory,
        string memory,
        string memory,
        string memory,
        string memory,
        string memory,
        string memory,
        string memory
    ) external payable returns (uint256) {
        require(msg.value == price, "treasury");
        lastTo = to;
        lastValue = msg.value;
        tokenOwner = to;
        return 7;
    }

    function renewSubscription(uint256, uint64) external payable {
        require(msg.value == price, "treasury");
        lastValue = msg.value;
    }
}

contract MockSwapRouter is ISwapRouter {
    MockWETH public weth;
    MockERC20 public mooney;
    uint256 public pulled;

    constructor(MockWETH weth_, MockERC20 mooney_) {
        weth = weth_;
        mooney = mooney_;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut) {
        require(weth.transferFrom(msg.sender, address(this), params.amountIn), "pull");
        pulled = params.amountIn;
        amountOut = params.amountIn * 1000;
        require(amountOut >= params.amountOutMinimum, "slip");
        mooney.mint(params.recipient, amountOut);
    }
}

contract MockVe is IVotingEscrow {
    MockERC20 public mooney;
    mapping(address => int128) public amounts;
    mapping(address => uint256) public ends;

    constructor(MockERC20 mooney_) {
        mooney = mooney_;
    }

    function setLock(address who, int128 amount, uint256 end) external {
        amounts[who] = amount;
        ends[who] = end;
    }

    function locked(address addr) external view returns (int128 amount, uint256 end) {
        return (amounts[addr], ends[addr]);
    }

    function deposit_for(address addr, uint256 value) external {
        require(amounts[addr] > 0 && ends[addr] > block.timestamp, "no lock");
        require(mooney.transferFrom(addr, address(this), value), "pull");
        amounts[addr] += int128(uint128(value));
    }
}

contract CitizenCheckoutTest is Test {
    uint256 constant TREASURY = 0.027 ether;

    MockCitizen citizen;
    MockWETH weth;
    MockERC20 mooney;
    MockSwapRouter router;
    MockVe ve;
    CitizenCheckout checkout;
    CheckoutOnlyMinter allowlist;

    address buyer = address(0xB0B);
    address sponsor = address(0xB206);

    function setUp() public {
        citizen = new MockCitizen();
        citizen.setPrice(TREASURY);
        weth = new MockWETH();
        mooney = new MockERC20();
        router = new MockSwapRouter(weth, mooney);
        ve = new MockVe(mooney);
        checkout = new CitizenCheckout(
            address(this),
            address(citizen),
            address(router),
            address(weth),
            address(mooney),
            address(ve),
            sponsor,
            10000
        );
        allowlist = new CheckoutOnlyMinter(address(checkout));
        vm.deal(buyer, 10 ether);
        vm.deal(sponsor, 10 ether);
    }

    function testQuoteSplitsAQuarterToTheStake() public view {
        (uint256 treasury, uint256 stake, uint256 total) = checkout.quote(buyer, 365 days);
        assertEq(treasury, TREASURY);
        assertEq(total, (TREASURY * 4) / 3);
        assertEq(stake, total - treasury);
        assertEq(stake * 3, treasury);
    }

    function _profile(address to) internal pure returns (CitizenCheckout.Profile memory) {
        return CitizenCheckout.Profile(to, "Ada Lovelace", "bio", "ipfs://img", "Earth", "ada", "ada_l", "https://a.example", "public", "form-99");
    }

    function testMintForwardsTreasuryAndSwapsTheQuarter() public {
        uint256 total = (TREASURY * 4) / 3;
        vm.prank(buyer);
        uint256 tokenId = checkout.mint{value: total}(_profile(buyer), 1);
        assertEq(tokenId, 7);
        assertEq(citizen.lastTo(), buyer);
        assertEq(citizen.lastValue(), TREASURY);
        assertEq(router.pulled(), total - TREASURY);
        assertEq(mooney.balanceOf(buyer), (total - TREASURY) * 1000);
        assertEq(buyer.balance, 10 ether - total);
    }

    function testMintLocksWhenALiveAllowanceExists() public {
        uint256 total = (TREASURY * 4) / 3;
        uint256 stake = total - TREASURY;
        uint256 bought = stake * 1000;
        ve.setLock(buyer, 1, block.timestamp + 365 days);
        vm.prank(buyer);
        mooney.approve(address(ve), type(uint256).max);

        vm.prank(buyer);
        checkout.mint{value: total}(_profile(buyer), 1);

        assertEq(mooney.balanceOf(buyer), 0);
        assertEq(mooney.balanceOf(address(ve)), bought);
    }

    function testMintLeavesMooneyWhenThereIsNoLock() public {
        uint256 total = (TREASURY * 4) / 3;
        vm.prank(buyer);
        checkout.mint{value: total}(_profile(buyer), 1);
        assertGt(mooney.balanceOf(buyer), 0);
        assertEq(mooney.balanceOf(address(ve)), 0);
    }

    function testUnderpaymentReverts() public {
        vm.prank(buyer);
        vm.expectRevert();
        checkout.mint{value: TREASURY}(_profile(buyer), 1);
    }

    function testFreeMintRefundsAndDoesNotSwap() public {
        citizen.setPrice(0);
        vm.prank(buyer);
        checkout.mint{value: 0.01 ether}(_profile(buyer), 1);
        assertEq(citizen.lastValue(), 0);
        assertEq(router.pulled(), 0);
        assertEq(buyer.balance, 10 ether);
    }

    function testRenewStakesForTheTokenOwner() public {
        citizen.setTokenOwner(buyer);
        uint256 total = (TREASURY * 4) / 3;
        address payer = address(0xDAD);
        vm.deal(payer, total);
        vm.prank(payer);
        checkout.renew{value: total}(7, 365 days, 1);
        assertEq(citizen.lastValue(), TREASURY);
        assertEq(mooney.balanceOf(buyer), (total - TREASURY) * 1000);
    }

    function testSponsoredPartialStake() public {
        uint256 userPaid = ((TREASURY * 4) / 3) / 2;
        uint256 stake = userPaid / 4;
        vm.prank(sponsor);
        checkout.mintSponsored{value: TREASURY + stake}(_profile(buyer), stake, 1);
        assertEq(citizen.lastValue(), TREASURY);
        assertEq(router.pulled(), stake);
        assertEq(mooney.balanceOf(buyer), stake * 1000);
    }

    function testStrangerCannotSponsor() public {
        vm.prank(buyer);
        vm.expectRevert(CitizenCheckout.NotSponsor.selector);
        checkout.mintSponsored{value: TREASURY}(_profile(buyer), 0, 1);
    }

    function testAllowlistAcceptsOnlyTheCheckout() public view {
        assertTrue(allowlist.isWhitelisted(address(checkout)));
        assertFalse(allowlist.isWhitelisted(buyer));
    }
}
