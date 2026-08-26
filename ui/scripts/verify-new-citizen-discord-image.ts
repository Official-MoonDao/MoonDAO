/**
 * Reproduces (and then verifies the fix for) new-citizen Discord announcements
 * arriving without the citizen's portrait.
 *
 * Run against production data — no secrets required, everything it touches is
 * public:
 *
 *   yarn verify:new-citizen-discord-image
 *
 * Stage 1 reproduces the bug: it builds the `og:image` URL exactly as the
 * citizen profile page used to and tries to fetch it inside the budget a link
 * crawler allows. Stage 2 runs the same citizens through the fixed code. Stage 3
 * builds the real Discord request body and confirms the portrait now ships with
 * the message instead of being something Discord has to go and fetch.
 *
 * Citizens are sampled at random rather than newest-first on purpose. ipfs.io
 * answers quickly for any CID it already has cached, so re-requesting the same
 * handful of CIDs makes the bug disappear — which is exactly why this looked
 * unreproducible whenever someone re-opened the link to check on it. A brand-new
 * citizen's CID is never in that cache.
 */
import { CITIZEN_TABLE_NAMES, DISCORD_CITIZEN_ROLE_ID, DEPLOYED_ORIGIN } from 'const/config'
import {
  buildNewCitizenBody,
  buildNewCitizenContent,
  buildNewCitizenPayload,
  citizenImageFilename,
  citizenProfileUrl,
} from '@/lib/discord/newCitizenNotification'
import { fetchImageFromIPFSWithFallback } from '@/lib/ipfs/gateway'
import { generatePrettyLinkWithId } from '@/lib/subscription/pretty-links'
import { normalizeOgImageUrl } from '@/lib/utils/ogImage'

// Discord's link-preview crawler gives up on a slow image well before this;
// being generous here only makes the reproduction more conservative.
const CRAWLER_BUDGET_MS = 10000

const SAMPLE_SIZE = 6

type CitizenRow = { id: number; name: string; image: string; description?: string }

// The `og:image` the citizen profile page emitted before this fix.
function legacyOgImageUrl(image: string) {
  return `https://ipfs.io/ipfs/${image.split('ipfs://')[1]}`
}

async function fetchSampleCitizens(): Promise<CitizenRow[]> {
  const statement = `SELECT id,name,image,description FROM ${CITIZEN_TABLE_NAMES.arbitrum} WHERE image != '' AND name != ''`
  const res = await fetch(
    `https://tableland.network/api/v1/query?statement=${encodeURIComponent(statement)}`
  )
  if (!res.ok) {
    throw new Error(`Tableland query failed: HTTP ${res.status}`)
  }
  const rows: CitizenRow[] = await res.json()

  const sample: CitizenRow[] = []
  const pool = [...rows]
  while (sample.length < SAMPLE_SIZE && pool.length > 0) {
    sample.push(...pool.splice(Math.floor(Math.random() * pool.length), 1))
  }
  return sample
}

type FetchOutcome = { ok: boolean; detail: string; ms: number }

/**
 * A crawler needs the *whole* image inside its budget, so a fast set of response
 * headers followed by a stalled body still means no image in the embed. Compare
 * the bytes actually delivered against Content-Length rather than trusting the
 * status code.
 */
async function tryFetchWithinCrawlerBudget(url: string): Promise<FetchOutcome> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CRAWLER_BUDGET_MS)
  const started = Date.now()
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: 'follow' })
    if (!res.ok) {
      return { ok: false, detail: `HTTP ${res.status}`, ms: Date.now() - started }
    }

    const expected = Number(res.headers.get('content-length') || 0)
    const delivered = (await res.arrayBuffer()).byteLength
    const complete = delivered > 0 && (!expected || delivered === expected)

    return {
      ok: complete,
      detail: complete ? `${delivered} bytes` : `truncated after ${delivered} of ${expected} bytes`,
      ms: Date.now() - started,
    }
  } catch (err: any) {
    return {
      ok: false,
      detail: err?.name === 'AbortError' ? `no image in ${CRAWLER_BUDGET_MS}ms` : String(err),
      ms: Date.now() - started,
    }
  } finally {
    clearTimeout(timer)
  }
}

function line(ok: boolean, label: string, outcome: FetchOutcome) {
  const mark = ok ? 'PASS' : 'FAIL'
  console.log(`  [${mark}] ${label} — ${outcome.detail} (${outcome.ms}ms)`)
}

async function main() {
  const citizens = await fetchSampleCitizens()
  console.log(
    `Sampling ${citizens.length} random citizens from ${CITIZEN_TABLE_NAMES.arbitrum}: ${citizens
      .map((c) => `#${c.id}`)
      .join(' ')}\n`
  )

  console.log(`Stage 1 — reproduce: og:image as the profile page built it (ipfs.io)`)
  let legacyFailures = 0
  for (const citizen of citizens) {
    const url = legacyOgImageUrl(citizen.image)
    const outcome = await tryFetchWithinCrawlerBudget(url)
    if (!outcome.ok) legacyFailures++
    line(outcome.ok, `#${citizen.id} ${citizen.name}`, outcome)
  }
  console.log(
    `  => ${legacyFailures}/${citizens.length} portraits unreachable, so Discord drops the image\n`
  )

  console.log(`Stage 2 — verify: og:image as normalizeOgImageUrl now builds it`)
  let fixedFailures = 0
  for (const citizen of citizens) {
    const url = normalizeOgImageUrl(citizen.image)
    const outcome = await tryFetchWithinCrawlerBudget(url)
    if (!outcome.ok) fixedFailures++
    line(outcome.ok, `#${citizen.id} ${citizen.name}`, outcome)
  }
  console.log(`  => ${fixedFailures}/${citizens.length} unreachable\n`)

  console.log(`Stage 3 — verify: the portrait ships inside the Discord request`)
  let missingAttachments = 0
  for (const citizen of citizens) {
    const prettyLink = generatePrettyLinkWithId(citizen.name, citizen.id)
    const profileUrl = citizenProfileUrl(DEPLOYED_ORIGIN, prettyLink as string)

    let attachment
    try {
      const image = await fetchImageFromIPFSWithFallback(citizen.image)
      attachment = { bytes: image.bytes, contentType: image.contentType }
    } catch (err) {
      missingAttachments++
      console.log(`  [FAIL] #${citizen.id} ${citizen.name} — ${String(err)}`)
      continue
    }

    const imageFilename = citizenImageFilename(citizen.id, attachment.contentType)
    const payload = buildNewCitizenPayload({
      content: buildNewCitizenContent({
        citizenName: citizen.name,
        profileUrl,
        citizenRoleId: DISCORD_CITIZEN_ROLE_ID,
      }),
      profileUrl,
      description: citizen.description,
      imageFilename,
    })
    const { body } = buildNewCitizenBody(payload, imageFilename, attachment)

    const form = body as FormData
    const file = form.get('files[0]') as Blob | null
    const embedImage = payload.embeds?.[0]?.image?.url
    const ok =
      !!file &&
      file.size === attachment.bytes.byteLength &&
      embedImage === `attachment://${imageFilename}`

    if (!ok) missingAttachments++
    console.log(
      `  [${ok ? 'PASS' : 'FAIL'}] #${citizen.id} ${citizen.name} — ${
        file ? `${file.size} bytes uploaded as ${imageFilename}` : 'no file part'
      }, embed image ${embedImage ?? 'missing'}`
    )
  }
  console.log(`  => ${missingAttachments}/${citizens.length} messages without a portrait\n`)

  const reproduced = legacyFailures > 0
  const fixed = missingAttachments === 0

  console.log(
    `Reproduced the reported bug: ${reproduced ? 'yes' : 'no'} (${legacyFailures}/${
      citizens.length
    } imageless announcements on the old code)`
  )
  console.log(
    `Fixed: ${fixed ? 'yes' : 'no'} (${citizens.length - missingAttachments}/${
      citizens.length
    } announcements now carry the portrait)`
  )

  if (!reproduced) {
    console.log(
      '\nNote: ipfs.io served every sampled CID this run. It is intermittent by nature, ' +
        'which is why the bug showed up as "very often" rather than "always".'
    )
  }

  if (!fixed) {
    process.exitCode = 1
  }
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
