const ProjectABI = require("../../../../../ui/const/abis/Project.json");
const ProjectTeamCreatorABI = require("../../../../../ui/const/abis/ProjectTeamCreator.json");
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
    arbitrum: "0x83755AF34867a3513ddCE921E9cAd28f0828CDdB",
};
const PROJECT_TEAM_CREATOR_ADDRESSES = {
    arbitrum: "0xe5709Bc44427DCEF81fF2F718DFc6A032fD23bbF",
};
interface PinResponse {
    cid: string;
}

// Configuration constants
console.log(process.env.NEXT_PUBLIC_THIRDWEB_SECRET_KEY);
console.log(process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID);
const TEST = false;
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

export async function pinBlobOrFile(blob: Blob): Promise<PinResponse> {
    try {
        const url = "https://api.pinata.cloud/pinning/pinFileToIPFS";

        // Create a FormData object to hold our file data
        const formData = new FormData();
        formData.append(
            "pinataMetadata",
            JSON.stringify({ name: "uploaded_file" })
        );
        formData.append("pinataOptions", JSON.stringify({ cidVersion: 0 }));
        formData.append("file", blob);

        // Send the POST request to Pinata
        const response = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.PINATA_JWT_KEY}`,
            },
            body: formData,
        });

        if (!response.ok) {
            throw new Error(
                `Error pinning file to IPFS: ${response.status} ${response.statusText}`
            );
        }

        // The response should return an object containing IpfsHash
        const jsonData = await response.json();
        return { cid: jsonData.IpfsHash };
    } catch (error) {
        console.error("pinBlobToIPFS failed:", error);
        throw error;
    }
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
        const projectTeamCreatorContract = await sdk.getContract(
            PROJECT_TEAM_CREATOR_ADDRESSES[chain.slug],
            ProjectTeamCreatorABI
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
        //const proposals = await getProposals("moondao", "current");

        //if (!proposals) {
        //throw new Error("Failed to fetch proposals from Nance");
        //}

        // 5. Find new MPDs to insert
        const existingMDPs = new Set(tablelandMDPs.map((row) => row.MDP));
        //const newProposals = proposals.filter(
        //(proposal) => !existingMDPs.has(proposal.proposalId)
        //);
        // .filter(proposal => proposal.status=="Approved")
        const newProposals = [
            {
                title: "Deprize Development",
                proposalId: 159,
                proposalLink: "https://moondao.com/proposal/159",
                lead: "0x679d87D8640e66778c3419D164998E720D7495f6",
                members: [
                    "0x80581C6e88Ce00095F85cdf24bB760f16d6eC0D6",
                    "0xb1d4c1B9c8DA3191Fdb515Fa7AdeC3D41D014F4f",
                    "0x08B3e694caA2F1fcF8eF71095CED1326f3454B89",
                    "0x25910143C255828F623786f46fe9A8941B7983bB",
                    "0xB2d3900807094D4Fe47405871B0C8AdB58E10D42",
                ],
                upfrontPayment: {
                    "0x08B3e694caA2F1fcF8eF71095CED1326f3454B89": 7.5,
                    "0x679d87D8640e66778c3419D164998E720D7495f6": 3.5,
                    "0xB2d3900807094D4Fe47405871B0C8AdB58E10D42": 3.5,
                    "0x80581C6e88Ce00095F85cdf24bB760f16d6eC0D6": 4.5,
                    "0xb1d4c1B9c8DA3191Fdb515Fa7AdeC3D41D014F4f": 3.5,
                },
            },
            {
                title: "Second Astronaut Support Q4",
                proposalId: 157,
                proposalLink: "https://moondao.com/proposal/157",
                lead: "0xe2d3aC725E6FFE2b28a9ED83bedAaf6672f2C801",
                members: [
                    "0x86c779b3741e83A36A2a236780d436E4EC673Af4",
                    "0xB2d3900807094D4Fe47405871B0C8AdB58E10D42",
                    "0xe2d3aC725E6FFE2b28a9ED83bedAaf6672f2C801",
                ],
            },
            {
                title: "New Worlds 2024 Sponsorship",
                proposalId: 153,
                proposalLink: "https://moondao.com/proposal/153",
                lead: "0xB2d3900807094D4Fe47405871B0C8AdB58E10D42",
                members: [
                    "0xB2d3900807094D4Fe47405871B0C8AdB58E10D42",
                    "0x679d87D8640e66778c3419D164998E720D7495f6",
                    "0xAfcB3224774297Cb67d20aF99eB2ccf80E9F51Ca",
                    "0x7F630377aBDB1423C3001a45b21909C93af607Bb",
                    "0xe2d3aC725E6FFE2b28a9ED83bedAaf6672f2C801",
                    "0x86c779b3741e83A36A2a236780d436E4EC673Af4",
                ],
            },
        ];

        // 6. Insert new projects
        for (const proposal of newProposals) {
            console.log(proposal);
            // Mock data - replace with actual data gathering logic
            //if (!proposal.ipfsURL) {
            //console.log(
            //"Skipping proposal with no IPFS URL:",
            //proposal.title
            //);
            //continue;
            //}
            if (existingMDPs.has(proposal.proposalId)) {
                console.log(
                    "Skipping existing proposal:",
                    proposal.title,
                    "with proposalId:",
                    proposal.proposalId
                );
                continue;
            }

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
            console.log(
                "Creating project team for proposal:",
                proposal.title,
                "with proposalId:",
                proposal.proposalId,
                "and members:",
                proposal.members,
                "and lead:",
                proposal.lead,
                "and upfrontPayment:",
                proposal.upfrontPayment,
                "and adminHatMetadataIpfsHash:",
                adminHatMetadataIpfsHash,
                "and managerHatMetadataIpfsHash:",
                managerHatMetadataIpfsHash,
                "and memberHatMetadataIpfsHash:",
                memberHatMetadataIpfsHash,
                "and proposalLink:",
                proposal.proposalLink,
                "and proposal:",
                proposal
            );

            const upfrontPayment = proposal.upfrontPayment
                ? JSON.stringify(proposal.upfrontPayment)
                : "";
            await projectTeamCreatorContract.call("createProjectTeam", [
                "ipfs://" + adminHatMetadataIpfsHash,
                "ipfs://" + managerHatMetadataIpfsHash,
                "ipfs://" + memberHatMetadataIpfsHash,
                proposal.title,
                "", // description
                "", // image
                4,
                2024,
                proposal.proposalId,
                "", // proposal ipfs
                proposal.proposalLink,
                upfrontPayment,
                proposal.lead, // leadAddress,
                proposal.members, // members,
            ]);

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
