// Airdrop
//
// Original airdrop plan:
// 5,000,000 $vMOONEY between all MoonDAO Citizens, locked for 4 years. (50k vMOONEY each).
// 5,000,000 $vMOONEY to all vMOONEY stakers (proportional to staked amount up to 100k vMOONEY).
//
// This implementation
// 5,100,000 $vMOONEY between all MoonDAO Citizens (**102**), locked for 4 years. (50k vMOONEY each).
// 5,000,000 $vMOONEY to all vMOONEY stakers (proportional to VOTING POWER up to 100k vMOONEY).

require("dotenv").config();
process.env.NEXT_PUBLIC_CHAIN = "mainnet";

import { CITIZEN_ADDRESSES, CITIZEN_TABLE_NAMES, DEFAULT_CHAIN_V5 } from "../../ui/const/config";
import { BLOCKED_CITIZENS } from "../../ui/const/whitelist";
import queryTable from "../../ui/lib/tableland/queryTable";
import { getChainSlug } from "../../ui/lib/thirdweb/chain";
import { getVMOONEYData } from "../../ui/lib/tokens/ve-subgraph";

interface Holder {
  address: string;
  balance: number;
}

interface Payout {
  address: string;
  payout: number;
}

function distributePayout(holders: Holder[], totalPayout: number, cap: number): Payout[] {
  let totalHoldings = holders.reduce((sum, holder) => sum + holder.balance, 0);
  let remainingPayout = totalPayout;
  let cappedHolders = new Set<string>();
  let payouts: Payout[] = [];

  // Initial payout calculation with cap enforcement
  holders.forEach((holder) => {
    let proportionalPayout = (holder.balance / totalHoldings) * totalPayout;
    if (proportionalPayout > cap) {
      proportionalPayout = cap;
      cappedHolders.add(holder.address);
    }
    payouts.push({ address: holder.address, payout: proportionalPayout });
    remainingPayout -= proportionalPayout;
  });

  // Redistribute excess funds from capped holders
  let uncappedTotalHoldings = holders
    .filter((holder) => !cappedHolders.has(holder.address))
    .reduce((sum, holder) => sum + holder.balance, 0);

  while (remainingPayout > 0 && uncappedTotalHoldings > 0) {
    let newRemainingPayout = remainingPayout;
    payouts = payouts.map(({ address, payout }) => {
      const holder = holders.find((h) => h.address === address)!;
      if (cappedHolders.has(address)) return { address, payout };

      let additionalPayout = (holder.balance / uncappedTotalHoldings) * remainingPayout;
      if (payout + additionalPayout > cap) {
        additionalPayout = cap - payout;
        cappedHolders.add(address);
      }

      newRemainingPayout -= additionalPayout;
      return { address, payout: payout + additionalPayout };
    });

    remainingPayout = newRemainingPayout;
    uncappedTotalHoldings = holders
      .filter((holder) => !cappedHolders.has(holder.address))
      .reduce((sum, holder) => sum + holder.balance, 0);
  }

  return payouts;
}

async function main() {
  const chain = DEFAULT_CHAIN_V5;
  const chainSlug = getChainSlug(chain);
  const citizenStatement = `SELECT * FROM ${CITIZEN_TABLE_NAMES[chainSlug]}`;
  const citizenRows = await queryTable(chain, citizenStatement);

  const validCitizens = citizenRows.filter((c: any) => !BLOCKED_CITIZENS.has(c.id));

  // Payout each mooney holder 50k vMOONEY
  const citizenPayouts = validCitizens.map((c: any) => {
      return {
          address: c.owner,
          payout: 50_000
      }
  });

  const vMooneyData = await getVMOONEYData();
  let holders: Holder[] = vMooneyData.holders.map((h: any) => ({
    address: h.address,
    balance: h.totalvMooney,
  }));
  // Distribute proportional payouts
  const holderPayouts = distributePayout(holders, 5_000_000, 100_000);



  const totalDistributedCitizens = citizenPayouts.reduce((sum, p) => sum + p.payout, 0);
  console.log("Citizen Payouts:");
  console.log(citizenPayouts);
  console.log(`Total payed out to citizens: ${totalDistributedCitizens}`);

  const totalDistributedHolders = holderPayouts.reduce((sum, p) => sum + p.payout, 0);
  console.log("Holder Payouts:");
  console.log(holderPayouts);
  console.log(`Total payed out to holders: ${totalDistributedHolders}`);

  const totalDistributed = totalDistributedHolders + totalDistributedCitizens;
  console.log(`Total Distributed: ${totalDistributed}`);

  const allPayouts : {[key: string]: number} = {}
  for (const { address, payout } of citizenPayouts) {
      allPayouts[address] = payout
  }
  for (const { address, payout } of holderPayouts) {
      if (allPayouts[address]) {
          allPayouts[address] += payout
      } else {
          allPayouts[address] = payout
      }
  }
  console.log('Final Payouts:', allPayouts)
  const totalPayouts = Object.values(allPayouts).reduce((sum, p) => sum + p, 0)
  console.log('Total payed out:', totalPayouts)

  const vMooneyAmounts = Object.values(allPayouts)
    .map((mooney) => `"0x${(mooney * 10 ** 18).toString(16)}"`)
    .join(',')
  console.log('Addresses:\n', Object.keys(allPayouts).join(','))
  console.log('Amounts:\n', vMooneyAmounts)
}

main().catch(console.error);
