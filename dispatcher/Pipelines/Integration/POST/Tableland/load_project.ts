const ProjectABI = require("../../../../../ui/const/abis/Project.json");
const ProjectTeamABI = require("../../../../../ui/const/abis/ProjectTeam.json");
require("dotenv").config();
const { ThirdwebSDK } = require("@thirdweb-dev/sdk");
const { Arbitrum, Sepolia } = require("@thirdweb-dev/chains");
const { getProposals } = require("../../GET/Nance/get_proposals");
//const {
//PROJECT_TABLE_ADDRESSES,
//PROJECT_TEAM_ADDRESSES,
//} = require("../../../../../ui/const/config.ts");
const PROJECT_TABLE_ADDRESSES = {
    // TODO update once mainnet is ready
    arbitrum: "0x2E8e4B7DAf62868d3184E691f3Cd5Bd9c069cAe1",
    sepolia: "0xC391008458004e33bED39EF2c2539857006c0c74",
};
const PROJECT_TEAM_ADDRESSES = {
    sepolia: "0x24411289007584aafCBfcE6406eC460cA01c7d3f",
};
const {
    pinBlobOrFile,
} = require("../../../../../ui/lib/ipfs/pinBlobOrFile.ts");

// Configuration constants
console.log(process.env.NEXT_PUBLIC_THIRDWEB_SECRET_KEY);
console.log(process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID);
const TEST = true;
const TABLELAND_ENDPOINT = `https://${
    TEST ? "testnets." : ""
}tableland.network/api/v1/query`;
const chain = TEST ? Sepolia : Arbitrum;
const privateKey = process.env.OPERATOR_PRIVATE_KEY;
// instantiate the SDK based on your private key, with the desired chain to connect to
//initSDK();
const sdk = ThirdwebSDK.fromPrivateKey(privateKey, chain.slug, {
    secretKey: process.env.NEXT_PUBLIC_THIRDWEB_SECRET_KEY,
});

// Escape quotes in the tile
function escapeSingleQuotes(str) {
    if (typeof str !== "string") {
        throw new TypeError("Input must be a string");
    }
    return str.replace(/'/g, "''");
}

function initSDK(chain) {
    return new ThirdwebSDK(chain, {
        clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID,
        secretKey: process.env.NEXT_PUBLIC_THIRDWEB_SECRET_KEY,
    });
}

// Main function to load project data
async function loadProjectData() {
    try {
        // 1. Initialize contract connection
        console.log("Connecting to contract...");
        //const sdk = initSDK(chain);
        const projectTableContract = await sdk.getContract(
            PROJECT_TABLE_ADDRESSES[chain.slug],
            ProjectABI
        );
        const projectTeamContract = await sdk.getContract(
            PROJECT_TEAM_ADDRESSES[chain.slug],
            ProjectTeamABI
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
            throw new Error(
                `Tableland query failed: ${projectsRes.statusText}`
            );
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
                console.log(
                    "Skipping proposal with no IPFS URL:",
                    proposal.title
                );
                continue;
            }

            const now = new Date();
            const adminHatMetadataBlob = new Blob(
                [
                    JSON.stringify({
                        type: "1.0",
                        data: {
                            name: "MDP-" + proposal.proposalId + " Admin",
                            description: proposal.title,
                        },
                    }),
                ],
                {
                    type: "application/json",
                }
            );

            const { cid: adminHatMetadataIpfsHash } =
                await pinBlobOrFile(adminHatMetadataBlob);

            const managerHatMetadataBlob = new Blob(
                [
                    JSON.stringify({
                        type: "1.0",
                        data: {
                            name: "MDP-" + proposal.proposalId + " Manager",
                            description: proposal.title,
                        },
                    }),
                ],
                {
                    type: "application/json",
                }
            );

            const { cid: managerHatMetadataIpfsHash } = await pinBlobOrFile(
                managerHatMetadataBlob
            );

            const memberHatMetadataBlob = new Blob(
                [
                    JSON.stringify({
                        type: "1.0",
                        data: {
                            name: "MDP-" + proposal.proposalId + " Member",
                            description: proposal.title,
                        },
                    }),
                ],
                {
                    type: "application/json",
                }
            );

            const { cid: memberHatMetadataIpfsHash } = await pinBlobOrFile(
                memberHatMetadataBlob
            );

            //await projectTeamContract.call("createProjectTeam", [
            //"ipfs://" + adminHatMetadataIpfsHash,
            //"ipfs://" + managerHatMetadataIpfsHash,
            //"ipfs://" + memberHatMetadataIpfsHash,
            //proposal.title,
            //Math.floor(now.getMonth() / 3) + 1,
            //now.getFullYear(),
            //proposal.proposalId,
            //proposal.ipfsURL,
            //"", // leadAddress,
            //[], // members,
            //]);

            //await projectTableContract.call("insertIntoTable", [
            //escapeSingleQuotes(proposal.title),
            //Math.floor(now.getMonth() / 3) + 1,
            //now.getFullYear(),
            //proposal.proposalId,
            //proposal.ipfsURL.split("/").pop(),
            //proposal.ipfsURL,
            //"",
            //"",
            //"",
            //]);
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

// main
loadProjectData();
