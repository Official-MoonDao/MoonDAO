// Writes the contribution archive as a CSV to import into the private archive
// Google Sheet (File → Import → Replace current sheet, on a tab named
// "archive"). Run it once to seed the sheet, and again after the Google Form
// closes to pick up the last of the open quarter.
//
//   npx ts-node -r tsconfig-paths/register scripts/contributions-archive-seed.ts \
//     --review <contributions_backfill_review.csv> --out <archive.csv> \
//     [--form <form responses.csv> --form-cycle 20264 --form-since 2026-10-08]
//
// The output holds wallets and names: keep it out of the repo, and share the
// sheet only with the site's service account and the people who maintain it.
import fs from 'fs'
import { ARCHIVE_COLUMNS, type ArchiveRecord } from '../lib/contributions/archive'
import {
  formRowToArchive,
  mergeArchive,
  reviewRowToArchive,
} from '../lib/contributions/archiveSeed'
import { parseCSV } from '../lib/contributions/getSheetContributions'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function readCsv(file: string): string[][] {
  return parseCSV(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')).filter((r) =>
    r.some((c) => c.trim())
  )
}

// A leading = would make Sheets run the cell as a formula on import. The
// apostrophe only marks it as text; the archive reader drops it.
function cell(value: string): string {
  const safe = value.startsWith('=') ? `'${value}` : value
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

function main() {
  const reviewFile = arg('review')
  const out = arg('out')
  const formFile = arg('form')
  const formCycle = Number(arg('form-cycle'))
  const formSince = arg('form-since')
  if (!reviewFile || !out || (formFile && (!Number.isInteger(formCycle) || !formSince))) {
    console.error(
      'Usage: --review <csv> --out <csv> [--form <csv> --form-cycle 20264 --form-since 2026-10-08]'
    )
    process.exit(1)
  }

  const [header, ...reviewRows] = readCsv(reviewFile)
  const review = reviewRows
    .map((r) => reviewRowToArchive(Object.fromEntries(header.map((h, i) => [h.trim(), r[i] ?? '']))))
    .filter((r): r is ArchiveRecord => r !== null)

  let form: ArchiveRecord[] = []
  if (formFile) {
    const since = Math.floor(new Date(formSince!).getTime() / 1000)
    form = readCsv(formFile)
      .slice(1)
      .map((cells) => formRowToArchive(cells, formCycle))
      .filter((r): r is ArchiveRecord => r !== null && Number(r.createdAt) >= since)
  }

  const archive = mergeArchive(review, form)
  const lines = [
    ARCHIVE_COLUMNS.join(','),
    ...archive.map((r) => ARCHIVE_COLUMNS.map((c) => cell(r[c])).join(',')),
  ]
  fs.writeFileSync(out, lines.join('\n') + '\n')

  const byCycle: Record<string, number> = {}
  for (const r of archive) byCycle[r.cycleId] = (byCycle[r.cycleId] ?? 0) + 1
  console.log(
    JSON.stringify(
      {
        reviewRows: reviewRows.length,
        fromReview: review.length,
        fromForm: archive.length - review.length,
        formRowsAlreadyInReview: form.length - (archive.length - review.length),
        total: archive.length,
        byCycle,
      },
      null,
      2
    )
  )
}

main()
