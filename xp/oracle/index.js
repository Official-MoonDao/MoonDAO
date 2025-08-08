const { ethers } = require("ethers");
const request = require("graphql-request");

// Core Oracle Configuration
const ORACLE_PRIVATE_KEY = process.env.ORACLE_PRIVATE_KEY;
const XP_MANAGER_ADDRESS = process.env.XP_MANAGER_ADDRESS;

// XP Manager ABI (minimal for claimXP function)
const XP_MANAGER_ABI = [
  "function claimXP(uint256 conditionId, bytes calldata context) external",
];

// HasVotingPower Verifier ABI
const HAS_VOTING_POWER_ABI = [
  "function oracle() external view returns (address)",
  "function SIGNATURE_TIMEOUT() external view returns (uint256)",
];

/**
 * Create signature for oracle verification
 * @param {string} user - User address
 * @param {number} minValue - Minimum value required
 * @param {number} xpAmount - XP amount to award
 * @param {number} timestamp - Current timestamp
 * @param {string} privateKey - Oracle private key
 * @returns {string} - Signature
 */
function createSignature(user, minValue, xpAmount, timestamp, privateKey) {
  const messageHash = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["address", "uint256", "uint256", "uint256"],
      [user, minValue, xpAmount, timestamp]
    )
  );

  const ethSignedMessageHash = ethers.utils.hashMessage(
    ethers.utils.arrayify(messageHash)
  );
  const wallet = new ethers.Wallet(privateKey);
  const signature = wallet.signMessage(ethers.utils.arrayify(messageHash));

  return signature;
}

/**
 * Generate context data for XP claim
 * @param {number} minValue - Minimum value required
 * @param {number} xpAmount - XP amount to award
 * @param {string} signature - Oracle signature
 * @returns {string} - Encoded context data
 */
function createContext(minValue, xpAmount, signature) {
  const timestamp = Math.floor(Date.now() / 1000);

  return ethers.utils.defaultAbiCoder.encode(
    ["uint256", "uint256", "uint256", "bytes"],
    [minValue, xpAmount, timestamp, signature]
  );
}

/**
 * Submit XP claim to blockchain
 * @param {Object} claimData - Claim data
 * @param {ethers.providers.Provider} provider - Ethereum provider
 * @param {string} userPrivateKey - User's private key for transaction
 * @param {number} verifierId - Verifier ID in XPManager
 * @returns {Promise<string>} - Transaction hash
 */
async function submitClaim(claimData, provider, userPrivateKey, verifierId) {
  const wallet = new ethers.Wallet(userPrivateKey, provider);
  const xpManager = new ethers.Contract(
    XP_MANAGER_ADDRESS,
    XP_MANAGER_ABI,
    wallet
  );

  const tx = await xpManager.claimXP(verifierId, claimData.context);
  const receipt = await tx.wait();

  console.log(
    `Claim submitted for ${claimData.user}: ${receipt.transactionHash}`
  );
  return receipt.transactionHash;
}

/**
 * Generic GraphQL query function
 * @param {string} endpoint - GraphQL endpoint
 * @param {string} query - GraphQL query
 * @returns {Promise<Object>} - Query result
 */
async function graphqlQuery(endpoint, query) {
  try {
    return await request(endpoint, query);
  } catch (error) {
    console.error(`GraphQL query error:`, error);
    throw error;
  }
}

/**
 * Validate oracle configuration
 * @returns {boolean} - True if configuration is valid
 */
function validateOracleConfig() {
  if (!ORACLE_PRIVATE_KEY) {
    throw new Error("ORACLE_PRIVATE_KEY environment variable is required");
  }
  if (!XP_MANAGER_ADDRESS) {
    throw new Error("XP_MANAGER_ADDRESS environment variable is required");
  }
  return true;
}

/**
 * Get current timestamp in seconds
 * @returns {number} - Current timestamp
 */
function getCurrentTimestamp() {
  return Math.floor(Date.now() / 1000);
}

/**
 * Process a batch of users with a custom processor function
 * @param {string[]} userAddresses - Array of user addresses
 * @param {Function} processor - Function to process each user
 * @returns {Promise<Object[]>} - Array of processed results
 */
async function processBatch(userAddresses, processor) {
  const results = [];

  for (const address of userAddresses) {
    try {
      const result = await processor(address);
      if (result) {
        results.push(result);
      }
    } catch (error) {
      console.error(`Error processing user ${address}:`, error);
    }
  }

  return results;
}

// Export core oracle utilities
module.exports = {
  // Configuration
  ORACLE_PRIVATE_KEY,
  XP_MANAGER_ADDRESS,
  XP_MANAGER_ABI,
  HAS_VOTING_POWER_ABI,

  // Core functions
  createSignature,
  createContext,
  submitClaim,
  graphqlQuery,
  validateOracleConfig,
  getCurrentTimestamp,
  processBatch,

  // Utilities
  ethers,
};
