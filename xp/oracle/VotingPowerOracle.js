const {
  createSignature,
  createContext,
  submitClaim,
  graphqlQuery,
  validateOracleConfig,
  getCurrentTimestamp,
  processBatch,
  ethers,
} = require("./index");

// Voting Power specific configuration
const HAS_VOTING_POWER_VERIFIER_ADDRESS =
  process.env.HAS_VOTING_POWER_VERIFIER_ADDRESS;

// Snapshot GraphQL endpoint
const SNAPSHOT_ENDPOINT = "https://hub.snapshot.org/graphql";

// Voting power thresholds and XP rewards
const VOTING_POWER_TIERS = [
  { minVP: 1000, xp: 10, name: "Small Holder" },
  { minVP: 5000, xp: 25, name: "Medium Holder" },
  { minVP: 10000, xp: 50, name: "Large Holder" },
  { minVP: 50000, xp: 100, name: "Whale" },
  { minVP: 100000, xp: 200, name: "Mega Whale" },
];

/**
 * Query voting power from Snapshot
 * @param {string} address - User address
 * @param {string} space - Snapshot space (default: tomoondao.eth)
 * @returns {Promise<number>} - Voting power
 */
async function getVotingPower(address, space = "tomoondao.eth") {
  try {
    const query = `
            {
                vp(voter: "${address}", space: "${space}") {
                    vp
                }
            }
        `;

    const data = await graphqlQuery(SNAPSHOT_ENDPOINT, query);
    return parseFloat(data.vp.vp) || 0;
  } catch (error) {
    console.error(`Error querying voting power for ${address}:`, error);
    return 0;
  }
}

/**
 * Query voting power for multiple addresses
 * @param {string[]} addresses - Array of user addresses
 * @param {string} space - Snapshot space
 * @returns {Promise<Object>} - Map of address to voting power
 */
async function getVotingPowers(addresses, space = "tomoondao.eth") {
  const results = {};

  for (const address of addresses) {
    results[address] = await getVotingPower(address, space);
  }

  return results;
}

/**
 * Determine XP reward based on voting power
 * @param {number} votingPower - User's voting power
 * @returns {Object} - XP amount and tier name
 */
function getXPReward(votingPower) {
  // Sort tiers by voting power (descending) to find the highest applicable tier
  const sortedTiers = [...VOTING_POWER_TIERS].sort((a, b) => b.minVP - a.minVP);

  for (const tier of sortedTiers) {
    if (votingPower >= tier.minVP) {
      return {
        xp: tier.xp,
        tier: tier.name,
        minVP: tier.minVP,
      };
    }
  }

  return { xp: 0, tier: "No Tier", minVP: 0 };
}

/**
 * Process a single user's voting power and create claim data
 * @param {string} userAddress - User address
 * @param {string} oraclePrivateKey - Oracle private key
 * @returns {Promise<Object>} - Claim data or null if ineligible
 */
async function processUser(userAddress, oraclePrivateKey) {
  try {
    // Get user's voting power
    const votingPower = await getVotingPower(userAddress);
    console.log(`User ${userAddress} has ${votingPower} voting power`);

    // Determine XP reward
    const reward = getXPReward(votingPower);

    if (reward.xp === 0) {
      console.log(
        `User ${userAddress} doesn't meet minimum voting power requirements`
      );
      return null;
    }

    // Create signature using core utility
    const timestamp = getCurrentTimestamp();
    const signature = createSignature(
      userAddress,
      reward.minVP,
      reward.xp,
      timestamp,
      oraclePrivateKey
    );

    // Create context using core utility
    const context = createContext(reward.minVP, reward.xp, signature);

    return {
      user: userAddress,
      votingPower,
      tier: reward.tier,
      xp: reward.xp,
      minVP: reward.minVP,
      context,
      timestamp,
    };
  } catch (error) {
    console.error(`Error processing user ${userAddress}:`, error);
    return null;
  }
}

/**
 * Batch process multiple users using core utility
 * @param {string[]} userAddresses - Array of user addresses
 * @param {string} oraclePrivateKey - Oracle private key
 * @returns {Promise<Object[]>} - Array of claim data
 */
async function processUsers(userAddresses, oraclePrivateKey) {
  return processBatch(userAddresses, (address) =>
    processUser(address, oraclePrivateKey)
  );
}

/**
 * Main function to run the voting power oracle
 * @param {string[]} userAddresses - Array of user addresses to process
 * @param {string} space - Snapshot space (optional)
 */
async function runOracle(userAddresses, space = "tomoondao.eth") {
  // Validate configuration using core utility
  validateOracleConfig();

  console.log(`Processing ${userAddresses.length} users for space: ${space}`);

  // Process all users using core utility
  const results = await processUsers(
    userAddresses,
    process.env.ORACLE_PRIVATE_KEY
  );

  console.log(`\nResults:`);
  console.log(`Total users processed: ${userAddresses.length}`);
  console.log(`Eligible users: ${results.length}`);

  for (const result of results) {
    console.log(`\n${result.user}:`);
    console.log(`  Voting Power: ${result.votingPower}`);
    console.log(`  Tier: ${result.tier}`);
    console.log(`  XP Reward: ${result.xp}`);
    console.log(`  Context: ${result.context}`);
  }

  return results;
}

// Export voting power specific functions
module.exports = {
  getVotingPower,
  getVotingPowers,
  getXPReward,
  processUser,
  processUsers,
  runOracle,
  VOTING_POWER_TIERS,
  SNAPSHOT_ENDPOINT,
};

// Run if called directly
if (require.main === module) {
  const userAddresses = process.argv.slice(2);

  if (userAddresses.length === 0) {
    console.log("Usage: node VotingPowerOracle.js <address1> <address2> ...");
    process.exit(1);
  }

  runOracle(userAddresses)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Error:", error);
      process.exit(1);
    });
}
