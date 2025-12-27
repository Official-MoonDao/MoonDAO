const ProjectTableABI = require("../../../../../ui/const/abis/ProjectTable.json");
const ProjectTeamCreatorABI = require("../../../../../ui/const/abis/ProjectTeamCreator.json");
const { getRelativeQuarter } = require("../../../../../ui/lib/utils/dates");
require("dotenv").config();
const { ThirdwebSDK } = require("@thirdweb-dev/sdk");
const { Arbitrum, Sepolia } = require("@thirdweb-dev/chains");
const ethers = require("ethers");
const prompt = require("prompt-sync")();

const {
  getProposals,
  getNextProposalId,
} = require("../../GET/Nance/get_proposals");
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
  //secretKey: process.env.NEXT_PUBLIC_THIRDWEB_SECRET_KEY,
  secretKey: "",
});

const discordToEthAddress = {
  alexlayendecker_54332: "0xb87b8c495d3dae468d4351621b69d2ec10e656fe",
  "AriBruce#2325": "0x2c485a4DaD1c1a6a031A6DB08D5212b74A4A50e7",
  anastasiaadastra: "0x529bd2351476ba114f9d60e71a020a9f0b99f047",
  _anna5501: "0x6Af6DCac097EF957F0155d7Ce26CC65996226423",
  cryptoariel: "0x407F28ECd4e3EBC4288F5824e8De4fc0aF5463ED",
  ashsack: "0x3E08F6e00e78019AA571d144e1cC9b30E80F6646",
  astroeliza: "0x08E424b69851b7b210bA3E5E4233Ca6fcc1ADEdb",
  ballack6780: "0x6Ae385654CA814C5cAb3fF6a6deb420b681fE7A0",
  "Barney(🌜,🌛)#4593": "0x87D7276B0068ffcBA8C02781AA16484e935Bde28",
  benlifeship: "0x87678f9229910d5462Ee26Df6f7b4cf41888638C",
  carla0st: "0x573B64aB6896048EE3629C675a4BcF43f15CAe67",
  xtina_korp: "0x3ea48DFA0F7a57D08e3Dd093C78D1e300616B57d",
  ".coffeecrusher": "0x223da87421786DD8960bf2350e6c499BEbCA64d1",
  "name.get": "0x80581C6e88Ce00095F85cdf24bB760f16d6eC0D6",
  "N/A - Coordinape": "0x15B513F658f7390D8720dCE321f50974B28672EF",
  damian2848: "0x4b2F36E078A7eFeBe7A0680EDC340A4A60ca8946",
  ___mustang___: "0x1B7D7d183Bd233af690DDB33cE818f41995118a9",
  dreimanj: "0xe2d3aC725E6FFE2b28a9ED83bedAaf6672f2C801",
  djinnmorrison: "0x8a7fd7f4b1a77a606dfdd229c194b1f22de868ff",
  flowscience: "0x66CD14267fb5a1609496CdC37eB55E6FE3f59C75",
  social_hacker_38241: "0x04877685e94E0694944D08a43d021E5768b595f0",
  engi_bob: "0x4CBf10c36b481d6afF063070E35b4F42E7Aad201",
  frank041099: "0xf2befa4b9489c1ef75e069d16a6f829f71b4b988",
  favian23: "0xafa46468De1D6f1ab77DEFAe5F7657467911182d",
  _furda: "0x01A5109eC48a25C7c26C517b595FD7a5c2cE44eb",
  fiyinx20: "0x2753c791bCA3667f10800262FCB0168269e12DC5",
  "fraiz._.": "0xa1D84CD4Ab2e106B8114842b6B902E9462A73BAd",
  consigli3re: "0xeEA7d0FFc09997B8b0cC59C9BBC93cdEd33c14e4",
  gregsearch: "0x11646C2BbB14e5db25aB4b4BDAc38Fe35819F844",
  jaderiverstokes_: "0x08B3e694caA2F1fcF8eF71095CED1326f3454B89",
  jaderiverstokes: "0x08B3e694caA2F1fcF8eF71095CED1326f3454B89",
  jango420: "",
  jason_n_state_fan: "0x9345a54906191505c6Efd5FDd6A3F02D994C44Aa",
  jigglyjams: "0x25910143C255828F623786f46fe9A8941B7983bB",
  justinpark01: "0x9A1741b58Bd99EBbc4e9742Bd081b887DfC95f53",
  bestape: "0x0D89421D6eec0A4385F95f410732186A2Ab45077",
  larrotiz: "0x5640Ddc028f2436B5C0BA0305D2199556C1b5a95",
  "0xlucasart": "0xD5629b8bF9D81720b9A87E01BFbB5D3fc507fe4F",
  ".luffy54": "0xe6f4DC7260e77AA6Dc2F36596F3d19493eB20B93",
  "luisperdomo.eth": "0x157Bd0591c9E80B5640dEC001E9d73720fa19960",
  maccon_: "0x1EEc6A3e8f7a369fA4866C2c9B2d38d485511e86",
  manuelolariu: "0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401",
  ming6348: "0x7FD14Ce34975C4fcF8CffFc9E8eCc4ae5F5e21e3",
  mitchie_mitch: "0xb1d4c1B9c8DA3191Fdb515Fa7AdeC3D41D014F4f",
  HaonChon: "0x850a146D7478dAAa98Fc26Fd85e6A24e50846A9d",
  pmoncada: "0x679d87D8640e66778c3419D164998E720D7495f6",
  philiplinden: "0x6bFd9e435cF6194c967094959626ddFF4473a836",
  pipilu: "0x4c55c41bd839b3552fb2abecacfdf4a5d2879cb9",
  ".rocketryder": "0xAfcB3224774297Cb67d20aF99eB2ccf80E9F51Ca",
  ionrod: "0xA64f2228cceC96076c82abb903021C33859082F8",
  royalty3684: "0x1D6CAaCB0528fd7EfFfE9029604DD2049a40B3cE",
  malumek_41508: "0x00127f44bad82b9ea27245a14a4141e5ef0161a8",
  ryand2d: "0xB2d3900807094D4Fe47405871B0C8AdB58E10D42",
  ryan: "0xB2d3900807094D4Fe47405871B0C8AdB58E10D42",
  santiagoitzcoatl: "0xad43D363701Ed3EFC1263DC4b658745fA3E90e4B",
  si_karahoward: "0x8687ab2ff3188f961828fc2131b6150ee97bedce",
  astrosupreme: "",
  sheldenshi: "0xc2BCF46CBC9F4CedA617cB41F2158BE525dD008b",
  "super.jellie#9120": "0x8C1Bf43198c5E7cAB13439e0C53A8650033d03ef",
  cowtools4549: "0x2Ca5F90962c415DA3E3E1761f7Ca159d2E081c46",
  "sfladepo#2644": "0xEeBAEBaC995989A5Eda2e6149E7B9CD451459ee1",
  southside98: "0x3d802730A2F2e24b23d53cd7c5D9a06646e1ff10",
  i24titan: "0x86c779b3741e83A36A2a236780d436E4EC673Af4",
  twodam: "0xca6ed3fdc8162304d7f1fcfc9ca3a81632d5e5b0",
  "tyler.shm": "0x680f8C4b76AD9FBE3a25FF40aaceC9Aaf357B885",
  yankejun: "0x3e917eAdd649784aaFBEB5Cf4C9132fce42f9f90",
  ".zeroindex": "0x87D7276B0068ffcBA8C02781AA16484e935Bde27",
};

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
): Promise<[string[], string[]]> {
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

    const usernames: string[] = [];
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
      if (!address && username && discordToEthAddress[usernameWithoutAt]) {
        address = discordToEthAddress[usernameWithoutAt];
      }
      if (!address && ens) {
        address = await provider.resolveName(ens);
      }

      if (username) usernames.push(username);
      if (address) addresses.push(address);
    }

    return [addresses, usernames];
  } catch (error) {
    console.error("LLM address extraction failed:", error);
    return [[], []];
  }
}

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
      throw new Error(`Tableland query failed: ${projectsRes.statusText}`);
    }

    const tablelandMDPs = await projectsRes.json();
    console.log(`Found ${tablelandMDPs.length} existing MPDs in Tableland`);
    const existingMDPs = new Set(tablelandMDPs.map((row) => row.MDP));

    // Get proposals from Nance
    const nextProposalId = await getNextProposalId("moondao");
    let cycle = 64;
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
        var members = [];
        var membersUsernames = [];
        const [leads, leadsUsernames] = await getAddresses(proposal.body, [
          "Team Rocketeer",
          "Project Lead",
        ]);
        [members, membersUsernames] = await getAddresses(proposal.body, [
          "Initial Team",
        ]);
        // Only allow the first lead to be the lead for smart contract purposes
        if (leads.length > 1) {
          members = [...leads.slice(1), ...members];
          membersUsernames = [...leadsUsernames.slice(1), ...membersUsernames];
        }
        const [signers, signersUsernames] = await getAddresses(proposal.body, [
          "Multi-sig signers",
        ]);
        const abstractText = (await getAbstract(proposal.body)).slice(0, 1000);

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
        // allow keyboard input to confirm the proposal, otherwise skip
        const conf = prompt(
          `Create project for proposal ${proposal.proposalId} ${
            proposal.title
          }?\n\nlead ${leads[0]}\nmembers [${
            members.length > 0 ? members : [proposal.authorAddress]
          }]\n (${membersUsernames})\nsigners [${signers}]\n (${signersUsernames})\nabstract:\n ${abstractText}\n (y/n)`
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
        await projectTeamCreatorContract.call("createProjectTeam", [
          adminHatMetadataIpfs.value,
          managerHatMetadataIpfs.value,
          memberHatMetadataIpfs.value,
          proposal.title,
          abstractText, // description
          "", // image
          quarter,
          year,
          proposal.proposalId,
          "", // proposal ipfs
          "https://moondao.com/proposal/" + proposal.proposalId,
          upfrontPayment,
          leads[0] || "", // leadAddress,
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
