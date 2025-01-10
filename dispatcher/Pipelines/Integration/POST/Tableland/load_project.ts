const ProjectTableABI = require("../../../../../ui/const/abis/ProjectTable.json");
const ProjectTeamCreatorABI = require("../../../../../ui/const/abis/ProjectTeamCreator.json");
const { getRelativeQuarter } = require("../../../../../lib/utils/dates");
require("dotenv").config();
const { ThirdwebSDK } = require("@thirdweb-dev/sdk");
const { Arbitrum, Sepolia } = require("@thirdweb-dev/chains");
const { getProposals } = require("../../GET/Nance/get_proposals");
const {
    PROJECT_TABLE_ADDRESSES,
    PROJECT_CREATOR_ADDRESSES,
} = require("../../../../../ui/const/config.ts");

// Configuration constants
const TEST = false;
const IS_THIS_QUARTER = true;
const TABLELAND_ENDPOINT = `https://${
    TEST ? "testnets." : ""
}tableland.network/api/v1/query`;
const chain = TEST ? Sepolia : Arbitrum;
const privateKey = process.env.OPERATOR_PRIVATE_KEY;
const sdk = ThirdwebSDK.fromPrivateKey(privateKey, chain.slug, {
    secretKey: process.env.NEXT_PUBLIC_THIRDWEB_SECRET_KEY,
});

interface PinResponse {
    cid: string;
}
export async function pinBlobOrFile(blob: Blob): Promise<PinResponse> {
    try {
        const url = "https://api.pinata.cloud/pinning/pinFileToIPFS";
        const formData = new FormData();
        formData.append(
            "pinataMetadata",
            JSON.stringify({ name: "uploaded_file" })
        );
        formData.append("pinataOptions", JSON.stringify({ cidVersion: 0 }));
        formData.append("file", blob);

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
        const projectTableContract = await sdk.getContract(
            PROJECT_TABLE_ADDRESSES[chain.slug],
            ProjectTableABI
        );
        const projectTeamCreatorContract = await sdk.getContract(
            PROJECT_CREATOR_ADDRESSES[chain.slug],
            ProjectTeamCreatorABI
        );

        const projectBoardTableName =
            await projectTableContract.call("getTableName");

        // Query existing MPDs from Tableland
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

        // Get proposals from Nance
        const proposals = await getProposals("moondao", "current");

        if (!proposals) {
            throw new Error("Failed to fetch proposals from Nance");
        }

        // Filter MPDs to insert
        // const newProposals = proposals.filter(proposal => proposal.status=="Approved")

        // Insert new projects
        const existingMDPs = new Set(tablelandMDPs.map((row) => row.MDP));
        for (const proposal of newProposals) {
            if (existingMDPs.has(proposal.proposalId)) {
                console.log(
                    "Skipping existing proposal MDP:",
                    proposal.proposalId,
                    " ",
                    proposal.title
                );
                continue;
            }
            function getHatMetadataIPFS(hatType) {
                const hatMetadataBlob = new Blob(
                    [
                        JSON.stringify({
                            type: "1.0",
                            data: {
                                name:
                                    "MDP-" +
                                    proposal.proposalId +
                                    " " +
                                    hatType,
                                description: proposal.title,
                            },
                        }),
                    ],
                    {
                        type: "application/json",
                    }
                );
                const { cid: hatMetadataIpfsHash } =
                    await pinBlobOrFile(hatMetadataBlob);
                return "ipfs://" + hat;
            }
            const { quarter, year } = getRelativeQuarter(
                IS_THIS_QUARTER ? 0 : -1
            );
            const upfrontPayment = proposal.upfrontPayment
                ? JSON.stringify(proposal.upfrontPayment)
                : "";
            await projectTeamCreatorContract.call("createProjectTeam", [
                getHatMetadata("Admin"),
                getHatMetadata("Manager"),
                getHatMetadata("Member"),
                proposal.title,
                "", // description
                "", // image
                quarter,
                year,
                proposal.proposalId,
                "", // proposal ipfs
                proposal.proposalLink,
                upfrontPayment,
                proposal.lead, // leadAddress,
                proposal.members, // members,
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

// main
loadProjectData();
