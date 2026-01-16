require("dotenv").config({ path: "../../.env" });
const {
  createThirdwebClient,
  getContract,
  prepareContractCall,
  sendAndConfirmTransaction,
} = require("thirdweb");
const { sepolia, arbitrum } = require("thirdweb/chains");
const { privateKeyToAccount } = require("thirdweb/wallets");
const CitizenTableV2ABI = require("./CitizenTableV2ABI.json");

function cleanData(obj) {
  const formattedObj = {};

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      let formattedString = obj[key]; // Directly assign obj[key] to formattedString

      // Check if the value is a string before attempting to replace
      if (typeof formattedString === "string") {
        //Escape single quote with double single quotes
        formattedString = formattedString.replace(/'/g, "''");
        // Replace emojis with nothing
        formattedString = formattedString.replace(
          /([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g,
          ""
        );
      }

      // Add the key and the potentially modified value to the new object
      formattedObj[key] = formattedString;
    }
  }

  return formattedObj;
}

//Constants
const ENV = "mainnet";
const CITIZEN_TABLE_NAME = "CITIZENTABLE_42161_98";
const NEW_CITIZEN_TABLE_ADDRESS = "0x0Eb1dF01b34cEDAFB3148f07D013793b557470d1";

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
const newCitizenTableContract = getContract({
  client,
  address: NEW_CITIZEN_TABLE_ADDRESS,
  chain,
  abi: CitizenTableV2ABI,
});

async function migrateCitizenTable() {
  const statement = `SELECT * FROM ${CITIZEN_TABLE_NAME}`;
  const citizenTableRes = await fetch(
    `${tablelandEndpoint}?statement=${statement}`
  );
  const citizenTableData = await citizenTableRes.json();

  for (const citizen of citizenTableData) {
    const {
      id,
      name,
      description,
      image,
      location,
      discord,
      twitter,
      instagram,
      linkedin,
      website,
      view,
      formId,
      owner,
    } = cleanData(citizen);

    let formattedLocation;
    if (typeof citizen.location === "string") {
      formattedLocation = citizen.location;
    } else {
      formattedLocation = JSON.stringify(citizen.location);
    }

    const transaction = prepareContractCall({
      contract: newCitizenTableContract,
      method: "insertIntoTable",
      params: [
        id,
        name,
        description,
        image,
        formattedLocation,
        discord,
        twitter,
        instagram,
        linkedin,
        website,
        view,
        formId,
        owner,
      ],
    });

    const receipt = await sendAndConfirmTransaction({
      account,
      transaction,
    });

    console.log(
      `Citizen ${id} has been migrated. Receipt: ${receipt.transactionHash}`
    );
  }
}

migrateCitizenTable();
