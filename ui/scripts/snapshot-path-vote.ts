/**
 * Generates the frozen final tally for the Overview "Path Forward" vote and
 * writes it to lib/overview-path-vote/closed-snapshot.json.
 *
 * Run once at close (with server env present), then commit the JSON:
 *   yarn snapshot:path-vote
 *
 * The page serves this committed snapshot whenever OVERVIEW_PATH_VOTE_CLOSED is
 * true, so the published outcome never drifts as live $OVERVIEW balances change.
 */
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

async function main() {
  // Imported after dotenv so the module's config reads see the loaded env.
  const { fetchPathVoteResults } = await import(
    '../lib/overview-path-vote/fetchResults'
  )

  console.log('[snapshot-path-vote] fetching live tally...')
  const results = await fetchPathVoteResults()

  if (results.totalVoters === 0) {
    console.warn(
      '[snapshot-path-vote] WARNING: tally returned 0 voters. Refusing to overwrite the snapshot with empty data. Check env (TABLELAND_PRIVATE_KEY, NEXT_PUBLIC_THIRDWEB_CLIENT_SECRET) and try again.'
    )
    process.exit(1)
  }

  const snapshot = {
    generatedAt: new Date().toISOString(),
    ...results,
  }

  const outPath = path.resolve(
    __dirname,
    '../lib/overview-path-vote/closed-snapshot.json'
  )
  fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2) + '\n')

  console.log(
    `[snapshot-path-vote] wrote ${outPath}\n` +
      `  totalVoters: ${snapshot.totalVoters}\n` +
      `  totalVoted: ${snapshot.totalVoted} $OVERVIEW\n` +
      `  winner: ${snapshot.winningOptionId ?? '(none / tie)'}`
  )
}

main().catch((err) => {
  console.error('[snapshot-path-vote] failed:', err)
  process.exit(1)
})
