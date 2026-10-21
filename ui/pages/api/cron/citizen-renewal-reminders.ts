import type { NextApiRequest, NextApiResponse } from 'next'
import {
  buildRenewalCoverageReport,
  countWindowPositions,
  envVarPresent,
  nonDryRunRejection,
  renewalCountsComplete,
  renewalDryRunSources,
  UpstreamNonJsonError,
  type RenewalDryRunReadFlags,
} from '@/lib/citizen/renewalCoverage'
import {
  assembleCoverageInputs,
  citizenTypeformFormIds,
  loadCitizenProfiles,
  loadExclusions,
  loadExpiresAt,
} from '@/lib/citizen/renewalCoverageRead'
import { redisFromEnv, runRenewalWritePass } from '@/lib/citizen/renewalCoverageWrite'

export const config = {
  maxDuration: 300,
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function providedSecret(req: NextApiRequest): string | undefined {
  const authHeader = first(req.headers.authorization)
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined
  return bearer || first(req.headers['x-cron-secret']) || first(req.query.secret)
}

const INCOMPLETE_COUNTS = 'Email bucket counts are incomplete and are not reported as zero.'

function dryRunSources(read: RenewalDryRunReadFlags) {
  return renewalDryRunSources(process.env, read)
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Unknown error'
  if (message.includes('@')) return 'Renewal reminder run failed'
  return message
}

/**
 * Citizen renewal reminder coverage.
 * Writes Kit tags only when RENEWAL_REMINDERS_LIVE is exactly "true" and
 * the query includes live=1. Otherwise this is the read-only dry run.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const expectedSecret = process.env.CRON_SECRET
  if (expectedSecret && providedSecret(req) !== expectedSecret) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  const rejection =
    nonDryRunRejection(first(req.query.dryRun)) || nonDryRunRejection(req.body?.dryRun)
  if (rejection) {
    return res.status(400).json({ ok: false, dryRun: true, error: rejection })
  }

  const read: RenewalDryRunReadFlags = {
    tableland: false,
    arbitrumExpiresAt: false,
    typeform: false,
    kit: false,
    firstRunExclusion: false,
  }
  const warnings: string[] = []

  try {
    const nowMs = Date.now()
    const profiles = await loadCitizenProfiles()
    read.tableland = true
    const expiresAt = await loadExpiresAt(profiles.map((profile) => profile.tokenId))
    read.arbitrumExpiresAt = true
    const positions = countWindowPositions(
      profiles.map((profile) => expiresAt.get(profile.tokenId) ?? null),
      nowMs
    )
    const formIds = citizenTypeformFormIds()
    const typeformToken = process.env.TYPEFORM_PERSONAL_ACCESS_TOKEN?.trim() || null
    const kitConfigured =
      envVarPresent(process.env, 'CONVERT_KIT_V4_API_KEY') ||
      envVarPresent(process.env, 'CONVERT_KIT_API_KEY')
    const exclusions = await loadExclusions()
    read.firstRunExclusion = exclusions.firstRunRedisChecked
    warnings.push(...exclusions.warnings)

    const missing: string[] = []
    if (!typeformToken) missing.push('TYPEFORM_PERSONAL_ACCESS_TOKEN')
    if (formIds.length === 0) {
      missing.push(
        'NEXT_PUBLIC_TYPEFORM_CITIZEN_SHORT_FORM_ID, NEXT_PUBLIC_TYPEFORM_CITIZEN_FORM_ID, NEXT_PUBLIC_TYPEFORM_CITIZEN_EMAIL_FORM_ID'
      )
    }
    if (!kitConfigured) missing.push('CONVERT_KIT_V4_API_KEY or CONVERT_KIT_API_KEY')

    if (missing.length > 0) {
      warnings.push(
        `Missing ${missing.join('; ')}. Typeform or Kit was not read. ${INCOMPLETE_COUNTS}`
      )
      return res.status(503).json({
        ok: false,
        dryRun: true,
        readOnly: true,
        live: false,
        countsComplete: renewalCountsComplete(read),
        sources: dryRunSources(read),
        warnings,
        missing,
        positionCounts: positions,
        buckets: null,
        message:
          'Window counts come from chain reads. Email buckets were not computed because a required secret is missing.',
      })
    }

    const assembled = await assembleCoverageInputs({
      profiles,
      expiresAt,
      nowMs,
      formIds,
      typeformToken,
      kitConfigured: true,
      exclusions,
    })
    read.typeform = assembled.typeformRead
    read.kit = assembled.kitRead
    if (!assembled.ok || !renewalCountsComplete(read)) {
      const error = assembled.ok
        ? `Typeform or Kit was not read. ${INCOMPLETE_COUNTS}`
        : assembled.error
      warnings.push(error)
      if (error !== INCOMPLETE_COUNTS) warnings.push(INCOMPLETE_COUNTS)
      return res.status(503).json({
        ok: false,
        dryRun: true,
        readOnly: true,
        live: false,
        countsComplete: renewalCountsComplete(read),
        sources: dryRunSources(read),
        warnings,
        error,
        positionCounts: positions,
        buckets: null,
      })
    }

    const report = buildRenewalCoverageReport(assembled.rows, nowMs, {
      enterToday: positions.enterToday,
      inside: positions.inside,
      expiredWithin14: positions.expiredWithin14,
      outOfWindow: positions.outOfWindow,
    })

    const exclusionsReady = exclusions.suppressionChecked && exclusions.firstRunRedisChecked
    const writes = await runRenewalWritePass({
      env: process.env,
      liveParam: first(req.query.live),
      rows: assembled.rows,
      profiles,
      expiresAt,
      nowMs,
      formIds,
      typeformToken,
      exclusionsReady,
      exclusionSets: {
        suppressed: exclusions.suppressed,
        firstRunRedis: exclusions.firstRunRedis,
      },
      redis: exclusionsReady ? redisFromEnv(process.env) : null,
      allowKitReads: true,
    })
    warnings.push(...writes.warnings)

    console.log(
      '[citizen-renewal-reminders]',
      JSON.stringify({
        live: writes.live,
        counts: report.counts,
        countsComplete: true,
        expiryUnknown: positions.unknown,
        buckets: writes.buckets,
        skipped: writes.skipped,
        failures: writes.failures,
        sequenceRemoval: writes.sequenceRemoval,
        warnings,
      })
    )

    return res.status(200).json({
      ...report,
      dryRun: !writes.live,
      readOnly: !writes.live,
      live: writes.live,
      expiryUnknown: assembled.expiryUnknown,
      countsComplete: renewalCountsComplete(read),
      sources: dryRunSources(read),
      warnings,
      writes,
      exclusions: {
        suppressionChecked: exclusions.suppressionChecked,
        firstRunRedisChecked: exclusions.firstRunRedisChecked,
        firstRunRedisKey: 'renewal:exclude:first-run',
        suppressionKey: 'renewal:suppress',
        warnings: exclusions.warnings,
      },
    })
  } catch (error) {
    const message = safeError(error)
    const failedSource = error instanceof UpstreamNonJsonError ? error.source : null
    warnings.push(message)
    warnings.push(INCOMPLETE_COUNTS)
    console.error('[citizen-renewal-reminders]', message)
    return res.status(failedSource ? 503 : 500).json({
      ok: false,
      dryRun: true,
      live: false,
      countsComplete: false,
      sources: dryRunSources(read),
      warnings,
      failedSource,
      error: message,
    })
  }
}
