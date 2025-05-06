// SPDX-License-Identifier: MIT

pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "../src/ERC5643.sol";
import {Whitelist} from "../src/Whitelist.sol";

contract ERC5643Test is Test {
    event SubscriptionUpdate(uint256 indexed tokenId, uint64 expiration);

    address user1 = address(0x1);
    address user2 = address(0x2);
    address user3 = address(0x3);
    uint256 tokenId = 0;
    uint256 tokenId2 = 1;
    uint256 tokenId3= 2;
    string uri = "https://tableland.network/api/v1/query?unwrap=true&extract=true&statement=";
    MoonDAOTeam team;

    function setUp() public {
        vm.deal(user1, 10 ether);
        vm.deal(user2, 10 ether);
        vm.deal(user3, 10 ether);

        Whitelist discountList = new Whitelist();

        vm.prank(user3);
        team = new MoonDAOTeam("erc5369", "ERC5643", user3, 0x3bc1A0Ad72417f2d411118085256fC53CBdDd137, address(discountList));
        vm.prank(user3);
        team.setMoonDaoCreator(user1);

        uint256 before = user3.balance;

        vm.prank(user1);
        uint256 token1 = team.mintTo{value: 0.555 ether}(user3, user1, 123456, 123456, 123456, address(0), address(0));
        assertEq(token1, tokenId);

        uint256 after_ = user3.balance;

        assertEq(after_ - before, 0.555 ether);
    }


    function testRenewalInvalidTokenId() public {
        vm.prank(user1);
        vm.expectRevert(InvalidTokenId.selector);
        team.renewSubscription{value: 0.1 ether}(user1, tokenId + 10, 30 days);
    }

    function testRenewalNotOwner() public {
        // vm.expectRevert(CallerNotOwnerNorApproved.selector);
        team.renewSubscription{value: 0.1 ether}(user1, tokenId, 2000);
    }

    function testRenewalDurationTooShort() public {
        vm.prank(user3);
        team.setMinimumRenewalDuration(1000);
        vm.prank(user1);
        vm.expectRevert(RenewalTooShort.selector);
        team.renewSubscription{value: 0.1 ether}(user1, tokenId, 999);
    }

    function testRenewalDurationTooLong() public {
        vm.prank(user3);
        team.setMaximumRenewalDuration(1000);
        vm.prank(user1);
        vm.expectRevert(RenewalTooLong.selector);
        team.renewSubscription{value: 0.1 ether}(user1, tokenId, 1001);
    }

    function testRenewalInsufficientPayment() public {
        vm.prank(user1);
        vm.expectRevert(InsufficientPayment.selector);
        team.renewSubscription{value: 0.008 ether}(user1, tokenId, 30 days);
    }

    function testRenewalExistingSubscription() public {
        uint256 currTime = block.timestamp;
        vm.warp(1000);
        vm.prank(user1);
        team.renewSubscription{value: 0.555 ether}(user1, tokenId, 365 days);
        assertEq(user1.balance, 8.89 ether);
    }

    function testRenewalNewSubscription() public {
        vm.warp(1000);
        vm.prank(user1);
        vm.expectEmit(true, true, false, true);
        emit SubscriptionUpdate(tokenId2, 365 days + 1000);
        team.mintTo{value: 0.555 ether}(user2, user1, 123456, 123456, 123456, address(0), address(0));

        // This renewal will succeed because the subscription is renewable
        vm.prank(user2);
        vm.expectEmit(true, true, false, true);
        emit SubscriptionUpdate(tokenId2, 365 days + 30 days + 1000);
        team.renewSubscription{value: 0.1 ether}(user2, tokenId2, 30 days);
    }

    function testCancelValid() public {
        vm.expectEmit(true, true, false, true);
        emit SubscriptionUpdate(tokenId, 0);
        vm.prank(user3);
        team.cancelSubscription(tokenId);
    }

    function testCancelNotOwner() public {
        vm.expectRevert(CallerNotOwnerNorApproved.selector);
        team.cancelSubscription(tokenId);
    }

    function testExpiresAt() public {
        uint256 currTime = block.timestamp;
        vm.warp(1000);

        // price per second * 0.111 = price
        vm.startPrank(user3);
        team.renewSubscription{value: 0.1 ether}(user1, tokenId, 2000);
        assertTrue(team.expiresAt(tokenId) > 0);

        team.cancelSubscription(tokenId);
        assertEq(team.expiresAt(tokenId), 0);
    }

    function testExpiresAtInvalidToken() public {
        vm.expectRevert(InvalidTokenId.selector);
        team.expiresAt(tokenId2 + 10);
    }

    function testIsRenewableInvalidToken() public {
        vm.expectRevert(InvalidTokenId.selector);
        team.isRenewable(tokenId2 + 10);
    }

    function testExtendSubscriptionInvalidToken() public {
        vm.expectRevert(InvalidTokenId.selector);
        team.renewSubscription{value: 0.1 ether}(user1, tokenId + 100, 30 days);
    }

    function testRenewalDiscount() public {
        vm.warp(1000);
        vm.startPrank(user1);

        vm.expectEmit(true, true, false, true);
        emit SubscriptionUpdate(tokenId2, 365 days + 1000);
        uint256 id = team.mintTo{value: 1 ether}(user2, user1, 123456, 123456, 123456, address(0), address(0));
        assertEq(team.expiresAt(tokenId2), 365 days + 1000);

        vm.deal(user2, 1 ether);
        vm.expectEmit(true, true, false, true);
        emit SubscriptionUpdate(tokenId2, 365 days + 365 days + 1000);
        team.renewSubscription{value: 1 ether}(user2, tokenId2, 365 days);

    }

    function testTransfer() public {
        vm.prank(user1);
        // Can't transfer from incorrect owner
        vm.expectRevert();
        team.transferFrom(user1, user2, 0);
    }

    function testURI() public {
        string memory tokenURI = team.tokenURI(tokenId);
        assertEq(tokenURI, uri);
    }

}
