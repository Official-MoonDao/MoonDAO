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
    const citizenStatement = `SELECT * FROM ${CITIZEN_TABLE_NAMES[chainSlug]}`;
    const citizenRows = await queryTable(chain, citizenStatement);
    console.log("citizenRows", citizenRows);
}

main().catch(console.error);
