// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./StagedXPVerifier.sol";

/// @title ReferralsStaged
/// @notice Verifier that awards XP based on the number of referrals a user has made
/// @dev Stages are based on referral thresholds (e.g., 1 referral = stage 0, 5 referrals = stage 1, etc.)
contract ReferralsStaged is StagedXPVerifier {
    // Mapping from referred citizen address to the citizen who referred them
    mapping(address => address) public referredBy;
    
    // Mapping from citizen address to their total referral count
    mapping(address => uint256) public referralCount;
    
    // Address of the authorized signer who can call the "Referred" function
    address public authorizedSigner;
    
    // Events
    event ReferralRecorded(address indexed referredCitizen, address indexed referrer, uint256 newReferralCount);
    event AuthorizedSignerSet(address indexed oldSigner, address indexed newSigner);
    
    modifier onlyAuthorizedSigner() {
        require(msg.sender == authorizedSigner, "Only authorized signer can call this function");
        _;
    }
    
    constructor(address _authorizedSigner, address _xpManager) {
        require(_authorizedSigner != address(0), "Invalid authorized signer address");
        require(_xpManager != address(0), "Invalid XPManager address");
        
        authorizedSigner = _authorizedSigner;
        xpManager = _xpManager;
        
        // Initialize default stages (can be updated by admin)
        // Stage 0: 1 referral = 100 XP
        // Stage 1: 5 referrals = 250 XP  
        // Stage 2: 10 referrals = 500 XP
        // Stage 3: 25 referrals = 1000 XP
        // Stage 4: 50 referrals = 2000 XP
        _addStage(1, 100);
        _addStage(5, 250);
        _addStage(10, 500);
        _addStage(25, 1000);
        _addStage(50, 2000);
    }
    
    /**
     * @notice Record a new referral (only callable by authorized signer)
     * @param referredCitizenAddress Address of the citizen being referred
     * @param citizenAddress Address of the citizen making the referral
     */
    function referred(address referredCitizenAddress, address citizenAddress) external onlyAuthorizedSigner {
        require(referredCitizenAddress != address(0), "Invalid referred citizen address");
        require(citizenAddress != address(0), "Invalid citizen address");
        require(referredCitizenAddress != citizenAddress, "Cannot refer yourself");
        require(referredBy[referredCitizenAddress] == address(0), "Citizen already referred");
        
        // Record the referral relationship
        referredBy[referredCitizenAddress] = citizenAddress;
        
        // Increment the referrer's referral count
        referralCount[citizenAddress]++;
        
        emit ReferralRecorded(referredCitizenAddress, citizenAddress, referralCount[citizenAddress]);
    }
    
    /**
     * @notice Set the authorized signer address (only callable by XPManager)
     * @param _newSigner New authorized signer address
     */
    function setAuthorizedSigner(address _newSigner) external onlyOwner {
        require(_newSigner != address(0), "Invalid signer address");
        address oldSigner = authorizedSigner;
        authorizedSigner = _newSigner;
        emit AuthorizedSignerSet(oldSigner, _newSigner);
    }
    
    /**
     * @notice Override setXPManager to add access control
     * @param _xpManager Address of the XPManager contract
     */
    function setXPManager(address _xpManager) external override onlyOwner {
        require(_xpManager != address(0), "Invalid XPManager address");
        xpManager = _xpManager;
        emit XPManagerSet(_xpManager);
    }
    
    /**
     * @notice Get referral information for a citizen
     * @param citizen Address of the citizen
     * @return totalReferrals Total number of referrals made by the citizen
     * @return nextClaimableStage Next stage the citizen can claim
     * @return nextStageThreshold Threshold for the next stage
     */
    function getReferralInfo(address citizen) external view returns (
        uint256 totalReferrals,
        uint256 nextClaimableStage,
        uint256 nextStageThreshold
    ) {
        totalReferrals = referralCount[citizen];
        nextClaimableStage = getNextClaimableStage(citizen, totalReferrals);
        
        if (nextClaimableStage != type(uint256).max) {
            nextStageThreshold = stages[nextClaimableStage].threshold;
        } else {
            nextStageThreshold = 0;
        }
    }
    
    /**
     * @notice Check if a user is eligible for a specific stage based on referral count
     * @param user Address of the user
     * @param context Encoded context data (not used in this implementation)
     * @return eligible Whether the user is eligible
     * @return xpAmount Amount of XP to award
     */
    function _checkStageEligibility(address user, bytes calldata context)
        internal
        view
        override
        returns (bool eligible, uint256 stageIndex, uint256 xpAmount)
    {
        // Context is not used in this implementation - we only care about referral count
        uint256 userReferrals = referralCount[user];
        
        // Find the highest stage the user qualifies for based on their referral count
        uint256 highestQualifyingStage = type(uint256).max;
        
        for (uint256 i = 0; i < stages.length; i++) {
            if (stages[i].active && userReferrals >= stages[i].threshold) {
                highestQualifyingStage = i;
            } else {
                break; // Stages must be sequential, so we can break here
            }
        }
        
        if (highestQualifyingStage == type(uint256).max) {
            return (false, 0, 0);
        }
        
        // Check if this stage is the next one the user can claim
        if (userHighestClaimedStage[user] != highestQualifyingStage) {
            return (false, 0, 0);
        }
        
        return (true, highestQualifyingStage, stages[highestQualifyingStage].xpAmount);
    }
    
    /**
     * @notice Check bulk eligibility for all claimable stages based on referral count
     * @param user Address of the user
     * @param context Encoded context data (not used in this implementation)
     * @return eligible Whether the user is eligible for any stages
     * @return userMetric The user's current referral count
     */
    function _checkBulkEligibility(address user, bytes calldata context)
        internal
        view
        override
        returns (bool eligible, uint256 userMetric)
    {
        // Context is not used in this implementation
        userMetric = referralCount[user];
        
        // Check if user has any referrals and if they qualify for any stages
        if (userMetric == 0) {
            return (false, 0);
        }
        
        // Check if user qualifies for at least one stage
        for (uint256 i = 0; i < stages.length; i++) {
            if (stages[i].active && userMetric >= stages[i].threshold) {
                eligible = true;
                break;
            }
        }
        
        return (eligible, userMetric);
    }
    
    /**
     * @notice Generate a unique claim ID for a user and context
     * @param user Address of the user
     * @param context Encoded context data (not used in this implementation)
     * @return Unique claim identifier
     */
    function claimId(address user, bytes calldata context) external view override returns (bytes32) {
        // Include referral count to make claims unique per referral milestone
        uint256 referralCount = referralCount[user];
        return keccak256(abi.encodePacked(address(this), user, referralCount, "referral"));
    }
    
    /**
     * @notice Generate a bulk claim ID for claiming multiple stages at once
     * @param user Address of the user
     * @param context Encoded context data (not used in this implementation)
     * @return Unique bulk claim identifier
     */
    function bulkClaimId(address user, bytes calldata context) external view override returns (bytes32) {
        // Include current highest stage and referral count to make bulk claims unique
        uint256 currentHighest = userHighestClaimedStage[user];
        uint256 referralCount = referralCount[user];
        return keccak256(abi.encodePacked(address(this), user, referralCount, currentHighest, "referral_bulk"));
    }
}

