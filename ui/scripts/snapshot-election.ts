/**
 * Freezes the final tally for a ranked-choice election and writes it to
 * lib/elections/snapshots/<slug>.json.
 *
 * Run as soon as the election's `closesAt` passes (with server env present),
 * commit the JSON, then set `closed: true` on the election:
 *   yarn snapshot:election <slug>
 *
 * The Votes table has no timestamps and rows stay editable, so running this
 * promptly after close is what locks in the ballots. Voting power is read at
 * each chain's block at `closesAt`, so it is exact regardless of when this runs.
 */
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

async function main() {
  const slug = process.argv[2]
  if (!slug) {
    console.error('Usage: yarn snapshot:election <slug>')
    process.exit(1)
  }

  const { getElection } = await import('../lib/elections/elections')
  const { fetchElectionResults } = await import('../lib/elections/fetchElectionResults')

  const election = getElection(slug)
  if (!election) {
    console.error(`[snapshot-election] unknown election "${slug}"`)
    process.exit(1)
  }
  if (!election.closesAt || Date.now() < Date.parse(election.closesAt)) {
    console.error(`[snapshot-election] "${slug}" has not closed yet (closesAt=${election.closesAt}).`)
    process.exit(1)
  }

  console.log(`[snapshot-election] tallying ${slug} (voteId ${election.voteId})...`)
  const results = await fetchElectionResults(election)

  if (results.totalVoters === 0) {
    console.warn(
      '[snapshot-election] WARNING: 0 voters with voting power. This usually means the vMOONEY read failed. Refusing to write an empty snapshot; check env and retry.'
    )
    process.exit(1)
  }

  const snapshot = { ...results, generatedAt: new Date().toISOString() }
  const outDir = path.resolve(__dirname, '../lib/elections/snapshots')
  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, `${slug}.json`)
  fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2) + '\n')

  const { tally } = snapshot
  console.log(
    `[snapshot-election] wrote ${outPath}\n` +
      `  voters: ${snapshot.totalVoters}\n` +
      `  total VP: ${snapshot.totalVP.toFixed(2)}\n` +
      `  rounds: ${tally.rounds.length}\n` +
      `  winner: ${tally.tied ? '(unresolved tie)' : tally.winnerLabel ?? '(none)'}`
  )
}

main().catch((err) => {
  console.error('[snapshot-election] failed:', err)
  process.exit(1)
})
