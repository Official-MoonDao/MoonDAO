// Builds the Safe batches that import the reviewed contribution history into
// the onchain Contributions table. Nothing is sent: signers import the JSON
// files in Safe → Transaction Builder.
//
//   npx ts-node -r tsconfig-paths/register scripts/contributions-backfill.ts \
//     --csv ../docs/contributions-backfill/contributions_backfill_review.csv \
//     --chain sepolia --out <private dir> [--cycles 20264] [--simulate]
//
// Writes to --out:
//   safe-batch-<chain>-<k>-of-<n>.json  one Safe transaction each, in order
//   manifest.csv   what will be imported, without wallets (safe to publish)
//   skipped.csv    what won't be, and why (names as given: keep private)
//   summary.json   counts per cycle
//
// --simulate reads the live table (open cycle, seal, owner) and runs every
// importBatch call as a gas estimate from the owning Safe, so a revert or an
// over-limit batch shows up here instead of at signing. Run it again right before signing: each batch
// assumes the earlier ones have not executed yet, which is fine because
// imports don't depend on each other.
import ContributionsABI from 'const/abis/Contributions.json'
import fs from 'fs'
import path from 'path'
import {
  createPublicClient,
  decodeErrorResult,
  encodeFunctionData,
  http,
  type Abi,
  type Address,
  type Hex,
} from 'viem'
import { arbitrum, sepolia } from 'viem/chains'
import {
  estimateImportGas,
  packSafeTransactions,
  packStatements,
  planBackfill,
  type ImportRow,
  type PlannedRow,
  type ReviewRow,
} from '../lib/contributions/backfill'
import { contributionsTable, cycleLabel } from '../lib/contributions/onchain'
import { parseCSV } from '../lib/contributions/getSheetContributions'

const abi = ContributionsABI as Abi

const CHAINS = {
  arbitrum: {
    chain: arbitrum,
    rpc: 'https://arb1.arbitrum.io/rpc',
    safe: '0x29B0D7d7f0C88Ce0DF1De5888b37B90A6faF75cB',
  },
  sepolia: {
    chain: sepolia,
    rpc: 'https://ethereum-sepolia-rpc.publicnode.com',
    safe: '0xE5148e4399e3D849F629E0FECEcf6fC986e96127',
  },
} as const

type Args = {
  csv: string
  chain: keyof typeof CHAINS
  out: string
  cycles?: Set<number>
  openCycle?: number
  simulate: boolean
  rpc?: string
}

function parseArgs(argv: string[]): Args {
  const get = (name: string) => {
    const i = argv.indexOf(`--${name}`)
    return i >= 0 ? argv[i + 1] : undefined
  }
  const csv = get('csv')
  const chain = get('chain') as Args['chain']
  const out = get('out')
  if (!csv || !out || !chain || !(chain in CHAINS)) {
    console.error(
      'Usage: --csv <review.csv> --chain arbitrum|sepolia --out <dir> [--cycles 20264,20263] [--open-cycle 20264] [--simulate] [--rpc <url>]'
    )
    process.exit(1)
  }
  const cycles = get('cycles')
  return {
    csv,
    chain,
    out,
    cycles: cycles ? new Set(cycles.split(',').map(Number)) : undefined,
    openCycle: get('open-cycle') ? Number(get('open-cycle')) : undefined,
    simulate: argv.includes('--simulate'),
    rpc: get('rpc'),
  }
}

function readReviewRows(file: string): ReviewRow[] {
  const [header, ...rows] = parseCSV(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''))
  return rows
    .filter((r) => r.some((cell) => cell.trim()))
    .map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), r[i] ?? ''])))
}

function csvLine(cells: unknown[]): string {
  return cells
    .map((c) => {
      const s = c == null ? '' : String(c)
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    })
    .join(',')
}

function rewardSummary(row: ImportRow): string {
  const reward = JSON.parse(row.metadata).cycleReward
  return reward ? JSON.stringify(reward) : ''
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const { chain, rpc, safe } = CHAINS[args.chain]
  const table = contributionsTable(args.chain)
  if (!table) throw new Error(`No Contributions table configured for ${args.chain}`)
  const address = table.address as Address
  const client = createPublicClient({ chain, transport: http(args.rpc ?? rpc) })

  let openCycleId = args.openCycle
  if (args.simulate || openCycleId == null) {
    const read = (functionName: string, a: unknown[] = []) =>
      client.readContract({ address, abi, functionName, args: a } as any)
    const [cycle, sealed, owner] = await Promise.all([
      read('currentCycleId'),
      read('importsSealed'),
      read('owner'),
    ])
    if (sealed) throw new Error('Imports are sealed on this table')
    if (String(owner).toLowerCase() !== safe.toLowerCase())
      throw new Error(`Table owner is ${owner}, not the Safe ${safe}`)
    if (openCycleId != null && openCycleId !== Number(cycle))
      throw new Error(`--open-cycle ${openCycleId} but the table's open cycle is ${cycle}`)
    openCycleId = Number(cycle)
  }

  const now = Math.floor(Date.now() / 1000)
  const all = planBackfill(readReviewRows(args.csv), { openCycleId, now })
  const inScope = (p: PlannedRow) => !args.cycles || args.cycles.has(Number(p.source.cycleId))
  const planned = all.filter(inScope)
  const importing = planned.filter((p) => p.importRow)
  const rows = importing.map((p) => p.importRow!)

  const calls = packStatements(rows, table.name).map((batch) => ({
    batch,
    data: encodeFunctionData({ abi, functionName: 'importBatch', args: [batch] }),
    gas: estimateImportGas(batch),
  }))
  const safeTxs = packSafeTransactions(calls)

  fs.mkdirSync(args.out, { recursive: true })
  for (const f of fs.readdirSync(args.out))
    if (/^safe-batch-.*\.json$/.test(f)) fs.rmSync(path.join(args.out, f))

  let firstRow = 0
  safeTxs.forEach((group, k) => {
    const count = group.reduce((n, c) => n + c.batch.length, 0)
    const width = String(safeTxs.length).length
    const file = `safe-batch-${args.chain}-${String(k + 1).padStart(width, '0')}-of-${safeTxs.length}.json`
    const json = {
      version: '1.0',
      chainId: String(chain.id),
      createdAt: 0,
      meta: {
        name: `Contributions backfill ${k + 1} of ${safeTxs.length}`,
        description: `importBatch into ${table.name}: rows ${firstRow + 1}–${firstRow + count} of ${rows.length}, in ${group.length} call(s).`,
        txBuilderVersion: '1.16.5',
        createdFromSafeAddress: safe,
      },
      transactions: group.map((c) => ({
        to: address,
        value: '0',
        data: c.data,
        contractMethod: null,
        contractInputsValues: null,
      })),
    }
    firstRow += count
    fs.writeFileSync(path.join(args.out, file), JSON.stringify(json, null, 2))
  })

  fs.writeFileSync(
    path.join(args.out, 'manifest.csv'),
    [
      csvLine(['quarter', 'citizen_id', 'citizen_name', 'title', 'area', 'links', 'result', 'notes']),
      ...importing.map((p) =>
        csvLine([
          cycleLabel(Number(p.importRow!.cycleId)),
          p.source.citizen_id,
          p.source.citizen_name,
          p.importRow!.title,
          p.importRow!.area,
          p.importRow!.links ? JSON.parse(p.importRow!.links).length : 0,
          rewardSummary(p.importRow!),
          p.notes.join('; '),
        ])
      ),
    ].join('\n') + '\n'
  )
  fs.writeFileSync(
    path.join(args.out, 'skipped.csv'),
    [
      csvLine(['review_line', 'quarter', 'name_as_given', 'source', 'source_ref', 'reason']),
      ...planned
        .filter((p) => p.skipped)
        .map((p) =>
          csvLine([
            p.line,
            p.source.quarter,
            p.source.author_name_as_given,
            p.source.source,
            p.source.source_ref,
            p.skipped,
          ])
        ),
    ].join('\n') + '\n'
  )

  const byCycle: Record<string, { imported: number; skipped: Record<string, number> }> = {}
  for (const p of planned) {
    const c = (byCycle[cycleLabel(p.source.cycleId)] ??= { imported: 0, skipped: {} })
    if (p.importRow) c.imported++
    else c.skipped[p.skipped!] = (c.skipped[p.skipped!] ?? 0) + 1
  }
  const summary = {
    chain: args.chain,
    table: table.name,
    safe,
    openCycleId,
    reviewRows: all.length,
    inScope: planned.length,
    imported: rows.length,
    skipped: planned.length - rows.length,
    importBatchCalls: calls.length,
    safeTransactions: safeTxs.length,
    calldataBytes: calls.reduce((n, c) => n + (c.data.length - 2) / 2, 0),
    byCycle,
  }
  fs.writeFileSync(path.join(args.out, 'summary.json'), JSON.stringify(summary, null, 2) + '\n')
  console.log(JSON.stringify({ ...summary, byCycle: undefined }, null, 2))

  if (!args.simulate) return
  let failed = 0
  const measured = new Map<(typeof calls)[number], number>()
  for (const [i, call] of calls.entries()) {
    try {
      const gas = await client.estimateGas({ account: safe, to: address, data: call.data as Hex })
      measured.set(call, Number(gas))
      console.log(`importBatch ${i + 1}/${calls.length}: ${call.batch.length} rows, ok, ${gas} gas`)
    } catch (err: any) {
      failed++
      let reason = [err?.shortMessage ?? String(err), err?.details].filter(Boolean).join(': ')
      const data = err?.cause?.data ?? err?.data
      if (typeof data === 'string' && data.startsWith('0x')) {
        try {
          reason = decodeErrorResult({ abi, data: data as Hex }).errorName
        } catch {}
      }
      console.error(`importBatch ${i + 1}/${calls.length}: FAILS (${reason})`)
    }
  }
  // Arbitrum's per-transaction cap is 32M; leave room for the Safe and MultiSend.
  safeTxs.forEach((group, k) => {
    const gas = group.reduce((n, c) => n + (measured.get(c) ?? c.gas), 0)
    if (gas > 30_000_000) {
      failed++
      console.error(`Safe transaction ${k + 1}: ${gas} gas is over the 30M limit`)
    }
  })

  // Rows imported into the open cycle count toward each person's cap, but the
  // import doesn't check it. Warn when someone would end up over the cap.
  const open = rows.filter((r) => Number(r.cycleId) === openCycleId)
  if (open.length) {
    const maxPerCycle = Number(
      await client.readContract({ address, abi, functionName: 'maxPerCycle' } as any)
    )
    const perAuthor = new Map<string, number>()
    for (const r of open) perAuthor.set(r.author, (perAuthor.get(r.author) ?? 0) + 1)
    for (const [author, n] of perAuthor) {
      const existing = Number(
        await client.readContract({
          address,
          abi,
          functionName: 'countInCycle',
          args: [BigInt(openCycleId), author],
        } as any)
      )
      if (maxPerCycle && existing + n > maxPerCycle)
        console.warn(
          `${author}: ${existing} submitted + ${n} imported is over the cap of ${maxPerCycle} for ${cycleLabel(openCycleId)}`
        )
    }
  }
  if (failed) {
    console.error(`${failed} of ${calls.length} calls would revert`)
    process.exit(1)
  }
  console.log(`All ${calls.length} calls simulate cleanly from the Safe.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
