require("dotenv").config();
process.env.NEXT_PUBLIC_CHAIN = "mainnet";

import {
  CITIZEN_ADDRESSES,
  CITIZEN_TABLE_NAMES,
  DEFAULT_CHAIN_V5,
} from "../../ui/const/config";
import queryTable from "../../ui/lib/tableland/queryTable";
import { getChainSlug } from "../../ui/lib/thirdweb/chain";

async function main() {
  const chain = DEFAULT_CHAIN_V5;
  const chainSlug = getChainSlug(chain);
  const tableNames = [
    CITIZEN_TABLE_NAMES,
    PROJECT_TABLE_NAMES,
    DISTRIBUTION_TABLE_NAMES,
    VOTES_TABLE_NAMES,
    TEAM_TABLE_NAMES,
    MISSION_TABLE_NAMES,
  ];
  //tableNames.forEach((tableName) => {
  //const statement = `SELECT * FROM ${tableName[chainSlug]}`;
  //const rows = await queryTable(chain, statement);
  //console.log("citizenRows", rows);
  //});
  const tables = [JOBS_TABLE_ADDRESSES];
  tableNames.forEach((table) => {
    const tableContract = getContract({
      client: serverClient,
      address: table[chainSlug],
      abi: [
        {
          inputs: [],
          name: "getTableName",
          outputs: [{ internalType: "string", name: "", type: "string" }],
          stateMutability: "view",
          type: "function",
        },
      ],
      chain: chain,
    });
    const tableName = await readContract({
      contract: tableContract,
      method: "getTableName" as string,
      params: [],
    });
    console.log("tableName", tableName);
  });
}

main().catch(console.error);
