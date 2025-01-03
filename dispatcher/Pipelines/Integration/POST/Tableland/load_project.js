const ProjectABI = require("./Project.json");
require("dotenv").config();
const { ThirdwebSDK } = require("@thirdweb-dev/sdk");
const { Arbitrum, Sepolia } = require("@thirdweb-dev/chains");
const { getProposals } = require("../../GET/Nance/get_proposals");
const {
  PROJECT_TABLE_ADDRESSES,
} = require("../../../../../ui/const/config.ts");

// Configuration constants
const TEST = true;
const TABLELAND_ENDPOINT = `https://${
  TEST ? "testnets." : ""
}tableland.network/api/v1/query`;
const chain = TEST ? Sepolia : Arbitrum;
const privateKey = process.env.OPERATOR_PRIVATE_KEY;
// instantiate the SDK based on your private key, with the desired chain to connect to
const sdk = ThirdwebSDK.fromPrivateKey(privateKey, chain.slug);

// Escape quotes in the tile
function escapeSingleQuotes(str) {
  if (typeof str !== "string") {
    throw new TypeError("Input must be a string");
  }
  return str.replace(/'/g, "''");
}

console.log(process.env);

function initSDK(chain) {
  return new ThirdwebSDK(chain, {
    clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID,
    secretKey: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_SECRET,
  });
}

// Main function to load project data
async function loadProjectData() {
  try {
    // 1. Initialize contract connection
    console.log("Connecting to contract...");
    const projectTableContract = await sdk.getContract(
      PROJECT_TABLE_ADDRESSES[chain.slug],
      ProjectABI
    );

    // 2. Get table name from contract
    const projectBoardTableName =
      await projectTableContract.call("getTableName");
    console.log(`Connected to table: ${projectBoardTableName}`);

    // 3. Query existing MPDs from Tableland
    const projectStatement = `SELECT MDP FROM ${projectBoardTableName}`;
    const projectsRes = await fetch(
      `${TABLELAND_ENDPOINT}?statement=${projectStatement}`
    );

    if (!projectsRes.ok) {
      throw new Error(`Tableland query failed: ${projectsRes.statusText}`);
    }

    const tablelandMDPs = await projectsRes.json();
    console.log(`Found ${tablelandMDPs.length} existing MPDs in Tableland`);

    // 4. Get actual proposals from Nance
    const proposals = await getProposals("moondao", "current");

    if (!proposals) {
      throw new Error("Failed to fetch proposals from Nance");
    }

    // 5. Find new MPDs to insert
    const existingMDPs = new Set(tablelandMDPs.map((row) => row.MDP));
    const newProposals = proposals.filter(
      (proposal) => !existingMDPs.has(proposal.proposalId)
    );
    // .filter(proposal => proposal.status=="Approved")

    // 6. Insert new projects
    for (const proposal of newProposals) {
      console.log(proposal);
      // Mock data - replace with actual data gathering logic
      if (!proposal.ipfsURL) {
        console.log("Skipping proposal with no IPFS URL:", proposal.title);
        continue;
      }

      const now = new Date();

      await projectTableContract.call("insertIntoTable", [
        escapeSingleQuotes(proposal.title),
        Math.floor(now.getMonth() / 3) + 1,
        now.getFullYear(),
        proposal.proposalId,
        proposal.ipfsURL.split("/").pop(),
        proposal.ipfsURL,
        "",
        "",
        "",
      ]);
    }

    console.log("Data loading completed successfully");
  } catch (error) {
    console.error("Error loading project data:", error);
    throw error;
  }
}

// Export an execute function
module.exports = {
  async execute(input) {
    try {
      await loadProjectData();
      return { success: true };
    } catch (error) {
      console.error("Error in pipeline execution:", error);
      throw error;
    }
  },
};
