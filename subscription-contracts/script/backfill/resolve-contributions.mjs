#!/usr/bin/env node
/**
 * resolve-contributions.mjs
 *
 * Reconstructs the ORIGINAL (pre-reopen) contributions for a Juicebox project by
 * summing every `Pay` event's `amount` per beneficiary. The output seeds the
 * ReopenPayHook deposit ledger so original backers can be refunded EXACTLY the ETH
 * they contributed if the re-open round is wound down.
 *
 * Why Pay events (not balance / 1000): the Pay amount is the true ETH each backer
 * put in, independent of issuance rate, and it is unaffected by reserved-token
 * distribution. It is credited to the `beneficiary` (the token recipient).
 *
 * Usage:
 *   node script/backfill/resolve-contributions.mjs
 *
 * Env overrides:
 *   RPC_URL      default https://arb1.arbitrum.io/rpc
 *   TERMINAL     default 0x2dB6d704058E552DeFE415753465df8dF0361846
 *   PROJECT_ID   default 73
 *   FROM_BLOCK   default 440809003 (Frank mission creation block)
 *   TO_BLOCK     default latest
 *   HOOK         ReopenPayHook address (only needed to print the Safe "To" field)
 *   BATCH_SIZE   contributors per seedContributions call (default 150)
 *
 * Outputs:
 *   - A summary table + total (sanity-check against the terminal balance)
 *   - script/backfill/frank-contributions.json  { holders: [], amounts: [] }
 *   - seedContributions(...) calldata batches + lockLedger() calldata for the Safe
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RPC_URL = process.env.RPC_URL || "https://arb1.arbitrum.io/rpc";
const TERMINAL = (process.env.TERMINAL || "0x2dB6d704058E552DeFE415753465df8dF0361846").toLowerCase();
const PROJECT_ID = BigInt(process.env.PROJECT_ID || "73");
const FROM_BLOCK = BigInt(process.env.FROM_BLOCK || "440809003");
const HOOK = (process.env.HOOK || "").toLowerCase();
const BATCH_SIZE = Number(process.env.BATCH_SIZE || "150");

// Pay(uint256,uint256,uint256,address,address,uint256,uint256,string,bytes,address)
const PAY_TOPIC = "0x133161f1c9161488f777ab9a26aae91d47c0d9a3fafb398960f138db02c73797";
const SEED_SELECTOR = "0x4bbb48e4"; // seedContributions(address[],uint256[])
const LOCK_SELECTOR = "0xff4018d1"; // lockLedger()

// Reserved-token allocation holders — never contributed ETH, must be excluded.
const RESERVED = new Set(
  [
    "0x02430cc8e6932850a08d0c8820437a3229d8d6eb", // teamVesting
    "0x2f696b8102ce1214f7dfffe4f3c99684e13fc5b8", // moonDAOVesting
    "0x95fc39dd278b8dcd7b0219d6e109717d8e539114", // poolDeployer
  ].map((a) => a.toLowerCase())
);

const __dirname = dirname(fileURLToPath(import.meta.url));

let rpcId = 0;
async function rpc(method, params) {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`${method}: ${json.error.message || JSON.stringify(json.error)}`);
  return json.result;
}

const toHexBlock = (n) => "0x" + n.toString(16);
const topicForUint = (n) => "0x" + n.toString(16).padStart(64, "0");
const addrFromWord = (w) => "0x" + w.slice(24); // last 20 bytes of a 32-byte word

/** Adaptive-chunk eth_getLogs: halves the range on "range too large" style errors. */
async function getLogsChunked(fromBlock, toBlock, filterBase) {
  const out = [];
  let start = fromBlock;
  let span = 100_000n;
  while (start <= toBlock) {
    const end = start + span - 1n > toBlock ? toBlock : start + span - 1n;
    try {
      const logs = await rpc("eth_getLogs", [
        { ...filterBase, fromBlock: toHexBlock(start), toBlock: toHexBlock(end) },
      ]);
      out.push(...logs);
      process.stderr.write(`  scanned ${start}-${end} (+${logs.length})\n`);
      start = end + 1n;
      if (span < 100_000n) span *= 2n; // recover chunk size after a successful call
    } catch (e) {
      if (span <= 1n) throw e;
      span = span / 2n; // shrink and retry the same start
      process.stderr.write(`  range ${start}-${end} rejected (${e.message}); shrinking to ${span}\n`);
    }
  }
  return out;
}

async function main() {
  const latest = process.env.TO_BLOCK ? BigInt(process.env.TO_BLOCK) : BigInt(await rpc("eth_blockNumber"));
  process.stderr.write(
    `Scanning Pay events for project ${PROJECT_ID} on terminal ${TERMINAL}\n` +
      `  blocks ${FROM_BLOCK} .. ${latest}\n`
  );

  const logs = await getLogsChunked(FROM_BLOCK, latest, {
    address: TERMINAL,
    topics: [PAY_TOPIC, null, null, topicForUint(PROJECT_ID)],
  });

  // Decode: data = payer(32) beneficiary(32) amount(32) newlyIssued(32) ...
  const totals = new Map();
  for (const log of logs) {
    const data = log.data.slice(2);
    const beneficiary = addrFromWord(data.slice(64, 128)).toLowerCase();
    const amount = BigInt("0x" + data.slice(128, 192));
    if (amount === 0n) continue;
    if (RESERVED.has(beneficiary)) continue;
    if (beneficiary === "0x0000000000000000000000000000000000000000") continue;
    totals.set(beneficiary, (totals.get(beneficiary) || 0n) + amount);
  }

  const holders = [...totals.keys()];
  const amounts = holders.map((h) => totals.get(h));
  const grandTotal = amounts.reduce((a, b) => a + b, 0n);

  process.stderr.write(`\nFound ${logs.length} Pay events -> ${holders.length} unique contributors\n`);
  console.log("\n=== Original contributions (excludes reserved holders) ===");
  for (const h of holders) {
    console.log(`  ${h}  ${(Number(totals.get(h)) / 1e18).toFixed(6)} ETH  (${totals.get(h)} wei)`);
  }
  console.log(`\n  TOTAL: ${(Number(grandTotal) / 1e18).toFixed(6)} ETH  (${grandTotal} wei)`);
  console.log("  ^ sanity-check this against the terminal balance before seeding.\n");

  // Write JSON for the record / forge consumption.
  const outPath = join(__dirname, "frank-contributions.json");
  mkdirSync(__dirname, { recursive: true });
  writeFileSync(
    outPath,
    JSON.stringify(
      { projectId: PROJECT_ID.toString(), totalWei: grandTotal.toString(), holders, amounts: amounts.map(String) },
      null,
      2
    )
  );
  process.stderr.write(`Wrote ${outPath}\n`);

  // Build seedContributions calldata batches for the Safe Transaction Builder.
  console.log("=== Safe Transaction Builder actions ===");
  if (HOOK) console.log(`To (ReopenPayHook): ${HOOK}`);
  else console.log("To: <ReopenPayHook address> (set HOOK env to print here)");
  console.log("Value: 0 for every action below\n");

  for (let i = 0; i < holders.length; i += BATCH_SIZE) {
    const hb = holders.slice(i, i + BATCH_SIZE);
    const ab = amounts.slice(i, i + BATCH_SIZE);
    console.log(`--- seedContributions batch ${i / BATCH_SIZE + 1} (${hb.length} holders) ---`);
    console.log(encodeSeed(hb, ab));
    console.log("");
  }
  console.log("--- lockLedger() ---");
  console.log(LOCK_SELECTOR);
  console.log(
    "\nOrder in the Safe multisend: all seedContributions batches, then lockLedger(), then queueRulesetsOf (from the forge script)."
  );
}

/** ABI-encode seedContributions(address[] holders, uint256[] amounts). */
function encodeSeed(holders, amounts) {
  const n = holders.length;
  const word = (hex) => hex.replace(/^0x/, "").padStart(64, "0");
  const uintWord = (v) => BigInt(v).toString(16).padStart(64, "0");

  // head: two dynamic params -> two offset words
  const offHolders = 0x40; // 2 * 32
  // holders array block: length + n words
  const holdersBlockWords = 1 + n;
  const offAmounts = offHolders + holdersBlockWords * 32;

  let body = "";
  body += uintWord(offHolders);
  body += uintWord(offAmounts);
  // holders array
  body += uintWord(n);
  for (const h of holders) body += word(h.toLowerCase());
  // amounts array
  body += uintWord(n);
  for (const a of amounts) body += uintWord(a);

  return SEED_SELECTOR + body;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
