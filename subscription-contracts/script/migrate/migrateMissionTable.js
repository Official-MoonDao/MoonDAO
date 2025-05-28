require("dotenv").config({ path: "../../.env" });
const {
  createThirdwebClient,
  getContract,
  prepareContractCall,
  sendAndConfirmTransaction,
} = require("thirdweb");
const { sepolia, arbitrum } = require("thirdweb/chains");
const { privateKeyToAccount } = require("thirdweb/wallets");
const MissionTableABI = require("./MissionTableABI.json");

//Constants
const ENV = "testnet";
const MISSION_TABLE_NAME = "JBTeamProjectTable_11155111_1901";
const NEW_MISSION_TABLE_ADDRESS = "0x15C66A3F9227B84428dA45C3efD01f9fb842D2F1";

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
const newMissionTableContract = getContract({
  client,
  address: NEW_MISSION_TABLE_ADDRESS,
  chain,
  abi: MissionTableABI,
});

async function migrateTeamTable() {
  const statement = `SELECT * FROM ${MISSION_TABLE_NAME}`;
  const teamTableRes = await fetch(
    `${tablelandEndpoint}?statement=${statement}`
  );
  const missionTableData = await teamTableRes.json();

  for (const mission of missionTableData) {
    const { id, teamId, projectId } = mission;

    const transaction = prepareContractCall({
      contract: newMissionTableContract,
      method: "insertIntoTable",
      params: [teamId, projectId],
    });

    const receipt = await sendAndConfirmTransaction({
      account,
      transaction,
    });

    console.log(
      `Mission ${id} has been migrated. Receipt: ${receipt.transactionHash}`
    );
  }
}

migrateTeamTable();
