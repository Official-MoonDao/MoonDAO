require("dotenv").config({ path: "../../.env" });
const {
  createThirdwebClient,
  getContract,
  prepareContractCall,
  sendAndConfirmTransaction,
} = require("thirdweb");
const { sepolia, arbitrum } = require("thirdweb/chains");
const { privateKeyToAccount } = require("thirdweb/wallets");
const TeamTableV2ABI = require("./TeamTableV2ABI.json");

//Constants
const ENV = "mainnet";
const TEAM_TABLE_NAME = "TEAMTABLE_42161_92";
const NEW_TEAM_TABLE_ADDRESS = "0x1C9B9847bE88eb3F7154bA6A4560Cb8D52A13dD9";

const chain = ENV === "mainnet" ? arbitrum : sepolia;
const tablelandEndpoint = `https://${
  ENV != "mainnet" ? "testnets." : ""
}tableland.network/api/v1/query`;

//Client
const client = new createThirdwebClient({
  secretKey: process.env.THIRDWEB_CLIENT_SECRET,
});
const account = privateKeyToAccount({
  client,
  privateKey: process.env.PRIVATE_KEY,
});

//Contracts
const newTeamTableContract = getContract({
  client,
  address: NEW_TEAM_TABLE_ADDRESS,
  chain,
  abi: TeamTableV2ABI,
});

async function migrateTeamTable() {
  const statement = `SELECT * FROM ${TEAM_TABLE_NAME}`;
  const teamTableRes = await fetch(
    `${tablelandEndpoint}?statement=${statement}`
  );
  const teamTableData = await teamTableRes.json();

  for (const team of teamTableData) {
    const {
      id,
      name,
      description,
      image,
      twitter,
      communications,
      website,
      view,
      formId,
    } = team;

    const transaction = prepareContractCall({
      contract: newTeamTableContract,
      method: "insertIntoTable",
      params: [
        id,
        name,
        description,
        image,
        twitter,
        communications,
        website,
        view,
        formId,
      ],
    });

    const receipt = await sendAndConfirmTransaction({
      account,
      transaction,
    });

    console.log(
      `Team ${id} has been migrated. Receipt: ${receipt.transactionHash}`
    );
  }
}

migrateTeamTable();
