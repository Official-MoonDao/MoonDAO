// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/XPManager.sol";
import "../src/verifiers/OwnsCitizenNFT.sol";
import "../src/mocks/MockERC5643Citizen.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../lib/contracts/contracts/extension/ProxyForUpgradeable.sol";

// Interface for CitizenReferralsStaged contract
interface ICitizenReferralsStaged {
    function referredBy(address user) external view returns (address);
}

// Mock CitizenReferralsStaged contract for testing
contract MockCitizenReferralsStaged is ICitizenReferralsStaged {
    mapping(address => address) public referredBy;
    
    function setReferral(address user, address referrer) external {
        referredBy[user] = referrer;
    }
}

// Mock ERC20 for testing
contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        _mint(msg.sender, 1000000 * 10 ** decimals()); // Mint 1M tokens to deployer
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

// XPManagerV2 - Ultra-optimized for size
contract XPManagerV2 is XPManager {
    // Packed into single storage slot
    struct Config {
        uint64 percentage; // Max 10000 (100%)
        bool active;
        uint64 maxDepth;
        uint64 unused; // Padding
    }
    
    Config public config;
    mapping(address => uint256) public referralXP;
    address public referralsContract;

    event ConfigSet(uint64 percentage, bool active, uint64 maxDepth);
    event ReferralsSet(address indexed oldContract, address indexed newContract);
    event ReferralXPEarned(address indexed referrer, address indexed referredUser, uint256 xpAmount);

    function setConfig(uint64 _percentage, bool _active, uint64 _maxDepth) external onlyOwner {
        require(_percentage <= 10000, "Invalid percentage");
        config = Config(_percentage, _active, _maxDepth, 0);
        emit ConfigSet(_percentage, _active, _maxDepth);
    }

    function setReferrals(address _contract) external onlyOwner {
        require(_contract != address(0), "Invalid address");
        address oldContract = referralsContract;
        referralsContract = _contract;
        emit ReferralsSet(oldContract, _contract);
    }

    function getReferralInfo(address user) external view returns (address referrer, uint256 referralXPAmount) {
        referrer = referralsContract != address(0) 
            ? ICitizenReferralsStaged(referralsContract).referredBy(user)
            : address(0);
        return (referrer, referralXP[user]);
    }

    function _grantXP(address user, uint256 amount) internal override {
        uint256 oldLevel = _getUserLevelInternal(user);
        userXP[user] += amount;
        
        if (config.active && referralsContract != address(0)) {
            address referrer = ICitizenReferralsStaged(referralsContract).referredBy(user);
            if (referrer != address(0)) {
                uint256 referralAmount = (amount * config.percentage) / 10000;
                if (referralAmount > 0) {
                    userXP[referrer] += referralAmount;
                    referralXP[referrer] += referralAmount;
                    emit XPEarned(referrer, referralAmount, userXP[referrer]);
                    emit ReferralXPEarned(referrer, user, referralAmount);
                }
            }
        }
        
        uint256 newLevel = _getUserLevelInternal(user);
        emit XPEarned(user, amount, userXP[user]);
        
        if (newLevel > oldLevel) {
            emit LevelUp(user, newLevel, userXP[user]);
        }
    }
}

contract XPManagerUpgradeTest is Test {
    XPManager public xpManager;
    XPManagerV2 public xpManagerV2;
    OwnsCitizenNFT public citizenVerifier;
    MockERC5643Citizen public citizenNFT;
    MockERC20 public rewardToken;
    MockCitizenReferralsStaged public citizenReferrals;

    address public user1 = address(0x1);
    address public user2 = address(0x2);
    address public user3 = address(0x3);
    address public owner = address(0x4);
    address public relayer = address(0x5);

    function setUp() public {
        // Deploy Citizen NFT
        citizenNFT = new MockERC5643Citizen("MoonDAO Citizen", "CITIZEN", address(0), address(0), address(0), address(0));

        // Deploy reward token
        rewardToken = new MockERC20("Reward Token", "REWARD");

        // Deploy CitizenReferralsStaged mock
        citizenReferrals = new MockCitizenReferralsStaged();

        // Deploy verifier
        citizenVerifier = new OwnsCitizenNFT(address(citizenNFT), 25);

        // Give users some Citizen NFTs
        citizenNFT.mintTo(user1);
        citizenNFT.mintTo(user2);
        citizenNFT.mintTo(user3);
    }

    function testUpgradeToReferralXPSharing() public {
        // Step 1: Deploy the original upgradeable XPManager
        XPManager implementation = new XPManager();
        
        bytes memory initData = abi.encodeWithSelector(
            XPManager.initialize.selector
        );
        
        ProxyForUpgradeable proxy = new ProxyForUpgradeable(
            address(implementation),
            initData
        );
        
        xpManager = XPManager(address(proxy));
        
        // Transfer ownership to test owner
        xpManager.transferOwnership(owner);
        
        // Register verifier and set up ERC20 rewards
        vm.startPrank(owner);
        xpManager.registerVerifier(1, address(citizenVerifier));
        xpManager.setERC20RewardConfig(address(rewardToken), 1000); // 1000 tokens per 1 XP
        xpManager.setCitizenNFTAddress(address(citizenNFT));
        vm.stopPrank();
        
        // Fund XPManager with reward tokens
        rewardToken.transfer(address(xpManager), 10000 * 10 ** 18);
        
        // Step 2: Test original functionality works
        console.log("=== Testing Original XPManager ===");
        
        // User1 claims XP
        vm.prank(relayer);
        xpManager.claimXPFor(user1, 1, "");
        
        uint256 user1XP = xpManager.getTotalXP(user1);
        console.log("User1 XP after claim:", user1XP);
        assertEq(user1XP, 25, "User1 should have 25 XP");
        
        // User2 claims XP
        vm.prank(relayer);
        xpManager.claimXPFor(user2, 1, "");
        
        uint256 user2XP = xpManager.getTotalXP(user2);
        console.log("User2 XP after claim:", user2XP);
        assertEq(user2XP, 25, "User2 should have 25 XP");
        
        // Step 3: Deploy XPManagerV2 with referral functionality
        console.log("\n=== Deploying XPManagerV2 with Referral XP Sharing ===");
        xpManagerV2 = new XPManagerV2();
        
        // Step 4: Upgrade the proxy to XPManagerV2
        console.log("Upgrading proxy to XPManagerV2...");
        vm.prank(owner);
        xpManager.upgradeTo(address(xpManagerV2));
        
        // Cast the proxy to XPManagerV2 interface
        xpManagerV2 = XPManagerV2(address(proxy));
        
        // Step 5: Verify all existing data is preserved
        console.log("\n=== Verifying Data Preservation After Upgrade ===");
        assertEq(xpManagerV2.getTotalXP(user1), 25, "User1 XP should be preserved");
        assertEq(xpManagerV2.getTotalXP(user2), 25, "User2 XP should be preserved");
        assertEq(xpManagerV2.owner(), owner, "Owner should be preserved");
        assertEq(xpManagerV2.verifiers(1), address(citizenVerifier), "Verifier should be preserved");
        
        // Step 6: Set up referral system
        console.log("\n=== Setting Up Referral System ===");
        vm.startPrank(owner);
        
        // Set referral config: 10% to referrer
        xpManagerV2.setConfig(1000, true, 0); // 10% to direct referrer only
        
        // Set the CitizenReferralsStaged contract address
        xpManagerV2.setReferrals(address(citizenReferrals));
        
        vm.stopPrank();
        
        // Set user3 as referrer for user1 in the CitizenReferralsStaged contract
        citizenReferrals.setReferral(user1, user3);
        
        // Verify referral setup
        (address referrer, uint256 referralXP) = xpManagerV2.getReferralInfo(user1);
        assertEq(referrer, user3, "User3 should be referrer for user1");
        assertEq(referralXP, 0, "User3 should have 0 referral XP initially");
        
        // Step 7: Test referral XP sharing
        console.log("\n=== Testing Referral XP Sharing ===");
        
        // Since user1 and user2 already claimed from verifier 1, let's test with user3
        // First, let's set user1 as referrer for user3
        citizenReferrals.setReferral(user3, user1);
        
        // User3 claims XP (should trigger referral sharing to user1)
        vm.prank(relayer);
        xpManagerV2.claimXPFor(user3, 1, "");
        
        // Check XP distribution
        uint256 user1XPAfter = xpManagerV2.getTotalXP(user1);
        uint256 user3XPAfter = xpManagerV2.getTotalXP(user3);
        (referrer, referralXP) = xpManagerV2.getReferralInfo(user1);
        
        console.log("User1 XP after referral claim:", user1XPAfter);
        console.log("User3 XP after referral claim:", user3XPAfter);
        console.log("User1 referral XP earned:", referralXP);
        
        // User3 should have the base XP (25)
        assertEq(user3XPAfter, 25, "User3 should have 25 XP from claiming");
        
        // User1 should have original XP + referral XP (25 + 10% of 25 = 25 + 2.5 = 27.5, rounded down to 27)
        // Note: This might be 27 or 28 depending on rounding, so we'll check it's in the right range
        assertTrue(user1XPAfter >= 27 && user1XPAfter <= 28, "User1 should have 27-28 XP total (25 original + 2-3 referral)");
        assertEq(referralXP, user1XPAfter - 25, "Referral XP should be the difference from original XP");
        
        // Step 8: Test that user2 (no referrer) doesn't trigger referral sharing
        console.log("\n=== Testing No Referral Sharing for User2 ===");
        
        // Since user2 already claimed from verifier 1, let's test with a new user
        address user4 = address(0x6);
        citizenNFT.mintTo(user4);
        
        uint256 user2XPBefore = xpManagerV2.getTotalXP(user2);
        uint256 user1XPBefore = xpManagerV2.getTotalXP(user1);
        
        // User4 claims XP (no referrer set)
        vm.prank(relayer);
        xpManagerV2.claimXPFor(user4, 1, "");
        
        uint256 user4XPAfter = xpManagerV2.getTotalXP(user4);
        uint256 user1XPAfter2 = xpManagerV2.getTotalXP(user1);
        
        console.log("User4 XP after claim:", user4XPAfter);
        console.log("User1 XP before:", user1XPBefore);
        console.log("User1 XP after:", user1XPAfter2);
        
        // User4 should get XP, but User1 should not get any additional referral XP
        assertEq(user4XPAfter, 25, "User4 should get 25 XP");
        assertEq(user1XPAfter2, user1XPBefore, "User1 should not get additional referral XP from user4");
        
        // Step 9: Test ERC20 rewards still work after upgrade
        console.log("\n=== Testing ERC20 Rewards After Upgrade ===");
        
        // Check that ERC20 rewards are distributed automatically when XP is earned
        // User3 and user4 should have received ERC20 rewards from their XP claims
        uint256 user3TokenBalance = rewardToken.balanceOf(user3);
        uint256 user4TokenBalance = rewardToken.balanceOf(user4);
        
        console.log("User3 token balance:", user3TokenBalance);
        console.log("User4 token balance:", user4TokenBalance);
        
        // Both users should have received ERC20 rewards (25 XP * 1000 conversion rate = 25000 tokens)
        assertEq(user3TokenBalance, 25000, "User3 should have received 25000 ERC20 tokens");
        assertEq(user4TokenBalance, 25000, "User4 should have received 25000 ERC20 tokens");
        
        console.log("\n=== Upgrade Test Completed Successfully! ===");
        console.log("SUCCESS: Original functionality preserved");
        console.log("SUCCESS: Referral XP sharing added via upgrade");
        console.log("SUCCESS: ERC20 rewards still work");
        console.log("SUCCESS: All user data preserved");
    }

    function testCannotUpgradeWithoutOwner() public {
        // Deploy original contract
        XPManager implementation = new XPManager();
        bytes memory initData = abi.encodeWithSelector(XPManager.initialize.selector);
        ProxyForUpgradeable proxy = new ProxyForUpgradeable(address(implementation), initData);
        xpManager = XPManager(address(proxy));
        
        // Transfer ownership to a different address
        xpManager.transferOwnership(owner);
        
        // Deploy V2
        xpManagerV2 = new XPManagerV2();
        
        // Try to upgrade without being owner - should fail
        vm.expectRevert();
        xpManager.upgradeTo(address(xpManagerV2));
    }

    function testReferralConfigValidation() public {
        // Deploy and upgrade to V2
        XPManager implementation = new XPManager();
        bytes memory initData = abi.encodeWithSelector(XPManager.initialize.selector);
        ProxyForUpgradeable proxy = new ProxyForUpgradeable(address(implementation), initData);
        xpManager = XPManager(address(proxy));
        
        // Transfer ownership to test owner
        xpManager.transferOwnership(owner);
        
        xpManagerV2 = new XPManagerV2();
        vm.prank(owner);
        xpManager.upgradeTo(address(xpManagerV2));
        xpManagerV2 = XPManagerV2(address(proxy));
        
        vm.startPrank(owner);
        
        // Test invalid percentage (>100%)
        vm.expectRevert("Invalid percentage");
        xpManagerV2.setConfig(10001, true, 0);
        
        // Test valid percentage
        xpManagerV2.setConfig(1000, true, 0); // 10%
        
        // Test invalid CitizenReferralsStaged contract setup
        vm.expectRevert("Invalid address");
        xpManagerV2.setReferrals(address(0));
        
        vm.stopPrank();
    }
}