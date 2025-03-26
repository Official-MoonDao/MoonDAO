const ProjectTableABI = require("../../../../../ui/const/abis/ProjectTable.json");
const ProjectTeamCreatorABI = require("../../../../../ui/const/abis/ProjectTeamCreator.json");
const { getRelativeQuarter } = require("../../../../../ui/lib/utils/dates");
import { resolveAddress } from "thirdweb/extensions/ens";
import { createThirdwebClient } from "thirdweb";
require("dotenv").config();
const { ThirdwebSDK } = require("@thirdweb-dev/sdk");
const { Arbitrum, Sepolia } = require("@thirdweb-dev/chains");
const prompt = require('prompt-sync')();

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
const client = createThirdwebClient({
    clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID as string,
});

interface PinResponse {
    cid: string;
}
export async function pinBlobOrFile(
    blob: Blob,
    name: string
): Promise<PinResponse> {
    try {
        const url = "https://api.pinata.cloud/pinning/pinFileToIPFS";
        const formData = new FormData();
        formData.append("pinataMetadata", JSON.stringify({ name: name }));
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
        const proposals = await getProposals("moondao", 26);

        if (!proposals) {
            throw new Error("Failed to fetch proposals from Nance");
        }

        // Insert new projects
        const existingMDPs = new Set(tablelandMDPs.map((row) => row.MDP));
        for (const proposal of proposals) {
            if (
                !proposal.body.includes("Abstract") ||
                !proposal.body.includes("Problem")
            ) {
                console.log(
                    "Skipping non project proposal MDP:",
                    proposal.proposalId,
                    " ",
                    proposal.title
                );
                continue;
            }
            var signers;
            var members = []
            if ("actions" in proposal){
                signers = proposal.actions[0].payload.multisigTeam.map((member) => member.address);
                members = proposal.actions[0].payload.projectTeam.map((member) => member.votingAddress);
            }else{
                const multisigLine = proposal.body
                    .split("\n")
                    .find((line) => line.includes("Multisig") || line.includes("Multi-sig") || line.includes("multisig"));
                console.log('multisigLine:', multisigLine);
                const addresses = multisigLine.match(/0x[a-fA-F0-9]{40}/g) || [];
                console.log("addresses:", addresses);
                const ensNames = multisigLine.match(/([a-zA-Z0-9-]+\.eth)/g) || [];
                console.log("ensNames:", ensNames);
                const ensAddresses = await Promise.all(
                    ensNames.map(async (name) => {
                        const address = await resolveAddress({
                            client,
                            name: name,
                        });
                        return address;
                    })
                );
                signers = addresses.concat(ensAddresses);
            }

            if (existingMDPs.has(proposal.proposalId)) {
                console.log(
                    "Skipping existing proposal MDP:",
                    proposal.proposalId,
                    " ",
                    proposal.title
                );
                continue;
            }
            // parse out tables from proposal.body which is in markdown format
            const getHatMetadataIPFS = async function (hatType: string) {
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
                const name = `MDP-${proposal.proposalId}-${hatType}.json`;
                const { cid: hatMetadataIpfsHash } = await pinBlobOrFile(
                    hatMetadataBlob,
                    name
                );
                return "ipfs://" + hatMetadataIpfsHash;
            };
            const { quarter, year } = getRelativeQuarter(
                IS_THIS_QUARTER ? 0 : -1
            );
            const upfrontPayment = proposal.upfrontPayment
                ? JSON.stringify(proposal.upfrontPayment)
                : "";
            const [
                adminHatMetadataIpfs,
                managerHatMetadataIpfs,
                memberHatMetadataIpfs,
            ] = await Promise.allSettled([
                getHatMetadataIPFS("Admin"),
                getHatMetadataIPFS("Manager"),
                getHatMetadataIPFS("Member"),
            ]);
            // allow keyboard input to confirm the proposal, otherwise skip
            const conf = prompt(
                `Create project for proposal ${proposal.proposalId} ${proposal.title}? (y/n)`
            );
            if (conf !== "y") {
                console.log("Skipping proposal MDP:", proposal.proposalId, " ", proposal.title);
                continue;
            }
            await projectTeamCreatorContract.call("createProjectTeam", [
                adminHatMetadataIpfs,
                managerHatMetadataIpfs,
                memberHatMetadataIpfs,
                proposal.title,
                "", // description
                "", // image
                quarter,
                year,
                proposal.proposalId,
                "", // proposal ipfs
                "https://moondao.com/proposal/" + proposal.proposalId,
                upfrontPayment,
                proposal.authorAddress || "", // leadAddress,
                members || [], // members
                signers || [], // signers,
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
