const ProjectTableABI = require("../../../../../ui/const/abis/ProjectTable.json");
const ProjectTeamCreatorABI = require("../../../../../ui/const/abis/ProjectTeamCreator.json");
const { getRelativeQuarter } = require("../../../../../ui/lib/utils/dates");
require("dotenv").config();
const { ThirdwebSDK } = require("@thirdweb-dev/sdk");
const { Arbitrum, Sepolia } = require("@thirdweb-dev/chains");
const ethers = require("ethers");
const prompt = require("prompt-sync")();
const { DISCORD_TO_ETH_ADDRESS } = require("../../../../../ui/const/usernames");

const {
  getProposals,
  getNextProposalId,
} = require("../../GET/Nance/get_proposals");
const {
  PROJECT_TABLE_ADDRESSES,
  PROJECT_CREATOR_ADDRESSES,
  IPFS_GATEWAY,
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
  //secretKey: process.env.NEXT_PUBLIC_THIRDWEB_SECRET_KEY,
  secretKey: "",
});

async function getAbstract(proposalBody: string): Promise<string | null> {
  const thePrompt =
    `You are reading a DAO proposal written in markdown. Extract the Abstract section from the proposal.\n` +
    `Return ONLY the text of the Abstract section, or null if not found.\n\n` +
    `Proposal:\n${proposalBody}`;

  try {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-20b",
          messages: [{ role: "user", content: thePrompt }],
          temperature: 0,
        }),
      }
    );

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim() || null;
    return text;
  } catch (error) {
    console.error("LLM abstract extraction failed:", error);
    return null;
  }
}

async function getAddresses(
  proposalBody: string,
  patterns: string[]
): Promise<string[]> {
  const roleDescription = patterns.join(" or ");
  const thePrompt =
    `You are reading a DAO proposal written in markdown. There will be Team Rocketeers, and Intial Team, and Multi-sig signers. Extract the usernames and corresponding Ethereum addresses for just the ${roleDescription}.\n` +
    `Look for Discord handles (usernames), Ethereum addresses (0x...) and ENS names (xxx.eth).\n` +
    `Return ONLY a valid JSON string which is an array of objects with the keys \"username\", \"address\" and \"ens\".\n` +
    `- Set missing values to null\n` +
    `If none are found, return an empty array.\n\n` +
    `Proposal:\n${proposalBody}`;

  try {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          messages: [{ role: "user", content: thePrompt }],
          temperature: 0,
        }),
      }
    );

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim() || "[]";
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      console.log("Failed to parse JSON from LLM response:", text);
      console.log("error", e);
      parsed = [];
    }

    const addresses: string[] = [];
    const provider = new ethers.providers.JsonRpcProvider(
      "https://eth.llamarpc.com"
    );

    for (const item of parsed) {
      const username = item.username;
      const usernameWithoutAt = username.replace(/@/g, "");
      const ens = item.ens;
      let address = item.address;

      // If no address but we have a username, try to resolve from mapping
      if (!address && username && DISCORD_TO_ETH_ADDRESS[usernameWithoutAt]) {
        address = DISCORD_TO_ETH_ADDRESS[usernameWithoutAt];
      }
      if (!address && ens) {
        address = await provider.resolveName(ens);
      }

      if (address) addresses.push(address);
    }

    return addresses;
  } catch (error) {
    console.error("LLM address extraction failed:", error);
    return [];
  }
}

interface PinResponse {
  cid: string;
  url: string;
}
export async function pinBlobOrFile(
  blob: Blob,
  name: string
): Promise<PinResponse> {
  try {
    const url = "https://api.pinata.cloud/pinning/pinFileToIPFS";
    const formData = new FormData();
    if (name) {
      formData.append("pinataMetadata", JSON.stringify({ name: name }));
    }
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
    const outUrl = `${IPFS_GATEWAY}${jsonData.IpfsHash}`;
    return { cid: jsonData.IpfsHash, url: outUrl };
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
      throw new Error(`Tableland query failed: ${projectsRes.statusText}`);
    }

    const tablelandMDPs = await projectsRes.json();
    console.log(`Found ${tablelandMDPs.length} existing MPDs in Tableland`);
    const existingMDPs = new Set(tablelandMDPs.map((row) => row.MDP));

    // Get proposals from Nance
    const nextProposalId = await getNextProposalId("moondao");
    let cycle = 82;
    let doneLooping = false;
    while (!doneLooping) {
      const proposals = await getProposals("moondao", cycle++);

      if (!proposals) {
        console.log("No proposals for cycle", cycle);
        continue;
      }
      // sort in order of id
      proposals.sort((a, b) => a.proposalId - b.proposalId);

      // Insert new projects
      for (const proposal of proposals) {
        if (proposal.proposalId === nextProposalId - 1) {
          doneLooping = true;
        }
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
        if (existingMDPs.has(proposal.proposalId)) {
          console.log(
            "Skipping existing proposal MDP:",
            proposal.proposalId,
            " ",
            proposal.title
          );
          continue;
        }

        let [leads, members, signers, abstractFull] = await Promise.all([
          getAddresses(proposal.body, ["Team Rocketeer", "Project Lead"]),
          getAddresses(proposal.body, ["Initial Team"]),
          getAddresses(proposal.body, ["Multi-sig signers"]),
          getAbstract(proposal.body),
        ]);
        // Only allow the first lead to be the lead for smart contract purposes
        const lead = leads[0] || proposal.authorAddress;
        if (leads.length > 1) {
          members = [...leads.slice(1), ...members];
        }
        const abstractText = abstractFull?.slice(0, 1000);

        // parse out tables from proposal.body which is in markdown format
        const getHatMetadataIPFS = async function (hatType: string) {
          const hatMetadataBlob = new Blob(
            [
              JSON.stringify({
                type: "1.0",
                data: {
                  name: "MDP-" + proposal.proposalId + " " + hatType,
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
        const { quarter, year } = getRelativeQuarter(IS_THIS_QUARTER ? 0 : -1);
        const upfrontPayment = proposal.upfrontPayment
          ? JSON.stringify(proposal.upfrontPayment)
          : "";
        // FIXME add budgets
        const budgets = {};
        if (!(proposal.proposalId in budgets)) {
          console.log("Skipping due to no budget");
          continue;
        }
        // allow keyboard input to confirm the proposal, otherwise skip
        const conf = prompt(
          `Create project for proposal ${proposal.proposalId} ${
            proposal.title
          }?\n\nlead ${leads[0]}\nmembers [${
            members.length > 0 ? members : [proposal.authorAddress]
          }]\nsigners [${signers}]\nabstract:\n ${abstractText}\n (y/n)`
        );
        if (conf !== "y") {
          console.log(
            "Skipping proposal MDP:",
            proposal.proposalId,
            " ",
            proposal.title
          );
          continue;
        }
        const [
          adminHatMetadataIpfs,
          managerHatMetadataIpfs,
          memberHatMetadataIpfs,
        ] = await Promise.allSettled([
          getHatMetadataIPFS("Admin"),
          getHatMetadataIPFS("Manager"),
          getHatMetadataIPFS("Member"),
        ]);
        if (
          adminHatMetadataIpfs.status !== "fulfilled" ||
          managerHatMetadataIpfs.status !== "fulfilled" ||
          memberHatMetadataIpfs.status !== "fulfilled"
        ) {
          console.error(
            "Failed to pin hat metadata IPFS: ",
            adminHatMetadataIpfs,
            managerHatMetadataIpfs,
            memberHatMetadataIpfs
          );
          continue;
        }

        const header = `# ${proposal.title}\n\n`;
        const fileName = `${proposal.title.replace(/\s+/g, "-")}.md`;

        const fileContents = JSON.stringify({
          body: header + proposal.body,
          budget: [
            {
              amount: String(budgets[proposal.proposalId]),
              token: "ETH",
              justification: "dev cost",
            },
          ],

          authorAddress: proposal.authorAddress,
          nonProjectProposal: false,
        });
        const file = new File([fileContents], fileName, {
          type: "application/json",
        });
        const { url: proposalIPFS } = await pinBlobOrFile(file, "");

        await projectTeamCreatorContract.call("createProjectTeam", [
          adminHatMetadataIpfs.value,
          managerHatMetadataIpfs.value,
          memberHatMetadataIpfs.value,
          proposal.title.replace(/'/g, "''"),
          abstractText.replace(/'/g, "''"), // description
          "", // image
          quarter,
          year,
          proposal.proposalId,
          proposalIPFS, // proposal ipfs
          "https://moondao.com/proposal/" + proposal.proposalId,
          upfrontPayment,
          leads[0] || proposal.authorAddress, // leadAddress,
          members.length > 0 ? members : [proposal.authorAddress], // members
          signers.length > 0 ? signers : [proposal.authorAddress], // signers,
        ]);
      }
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
