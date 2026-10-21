/// <reference types="node" />

/**
 * Load the Oct 2 renewal exclusion list into Redis.
 *
 *   yarn renewal:load-exclusions --csv /secure/oct2.csv --dry-run
 *   yarn renewal:load-exclusions --csv /secure/oct2.csv
 *
 * The CSV stays out of the repo. Dry run prints count=<n> and does not write.
 * A real run SADDs lowercase emails into renewal:exclude:first-run and prints
 * added=<n>. Neither path prints an email address.
 */
import { Redis } from '@upstash/redis'
import fs from 'fs'
import { FIRST_RUN_EXCLUSION_SET } from '../lib/citizen/renewalCoverage'

const EMAIL = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag)
  if (index === -1) return undefined
  return process.argv[index + 1]
}

export function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      cells.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  cells.push(current.trim())
  return cells
}

function emailColumn(header: string[]): number {
  return header.findIndex((cell) => /^(email|email_address|email address)$/i.test(cell))
}

export function parseExclusionEmails(csvText: string): string[] {
  const lines = csvText
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
  if (lines.length === 0) return []
  const rows = lines.map(parseCsvLine)
  const column = emailColumn(rows[0])
  const body = column >= 0 ? rows.slice(1) : rows
  const found = new Set<string>()
  for (const row of body) {
    const cells = column >= 0 ? [row[column] || ''] : row
    for (const cell of cells) {
      const value = cell.trim().toLowerCase()
      if (EMAIL.test(value)) found.add(value)
    }
  }
  return [...found]
}

export async function saddExclusionEmails(
  emails: string[],
  sadd: (key: string, members: string[]) => Promise<number>
): Promise<number> {
  const unique = [
    ...new Set(
      emails.map((email) => email.trim().toLowerCase()).filter((email) => EMAIL.test(email))
    ),
  ]
  if (unique.length === 0) return 0
  let added = 0
  const chunkSize = 200
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize)
    added += await sadd(FIRST_RUN_EXCLUSION_SET, chunk)
  }
  return added
}

async function saddWithRedis(key: string, members: string[]): Promise<number> {
  const url = process.env.UPSTASH_REDIS_URL
  const token = process.env.UPSTASH_REDIS_TOKEN
  if (!url || !token) {
    throw new Error('UPSTASH_REDIS_URL and UPSTASH_REDIS_TOKEN are required')
  }
  const redis = new Redis({ url, token })
  if (key !== FIRST_RUN_EXCLUSION_SET) throw new Error('unexpected exclusion key')
  const added = await redis.sadd(key, members[0], ...members.slice(1))
  return typeof added === 'number' ? added : members.length
}

async function main() {
  const csvPath = argValue('--csv')
  const dryRun = process.argv.includes('--dry-run')
  if (!csvPath || csvPath.startsWith('--')) {
    process.stderr.write('Usage: load-renewal-exclusions.ts --csv <path> [--dry-run]\n')
    process.exitCode = 1
    return
  }
  let text: string
  try {
    text = fs.readFileSync(csvPath, 'utf8')
  } catch {
    process.stderr.write('Cannot read the CSV file\n')
    process.exitCode = 1
    return
  }
  const emails = parseExclusionEmails(text)
  if (dryRun) {
    process.stdout.write(`count=${emails.length}\n`)
    return
  }
  try {
    const added = await saddExclusionEmails(emails, saddWithRedis)
    process.stdout.write(`added=${added}\n`)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Redis write failed'
    process.stderr.write(message.includes('@') ? 'Redis write failed\n' : `${message}\n`)
    process.exitCode = 1
  }
}

if (require.main === module) {
  main().catch(() => {
    process.stderr.write('Exclusion load failed\n')
    process.exitCode = 1
  })
}
