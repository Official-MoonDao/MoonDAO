import type { NextApiRequest, NextApiResponse } from 'next'
import {
  buildRenewalCoverageReport,
  countWindowPositions,
  nonDryRunRejection,
} from '@/lib/citizen/renewalCoverage'
import {
  assembleCoverageInputs,
  citizenTypeformFormIds,
  loadCitizenProfiles,
  loadExclusions,
  loadExpiresAt,
} from '@/lib/citizen/renewalCoverageRead'

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

/**
 * Dry-run coverage for citizen renewal reminders.
 * Always read-only. A request that asks for a live run is rejected.
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

  try {
    const nowMs = Date.now()
    const profiles = await loadCitizenProfiles()
    const expiresAt = await loadExpiresAt(profiles.map((profile) => profile.tokenId))
    const positions = countWindowPositions(
      profiles.map((profile) => expiresAt.get(profile.tokenId) ?? null),
      nowMs
    )
    const formIds = citizenTypeformFormIds()
    const typeformToken = process.env.TYPEFORM_PERSONAL_ACCESS_TOKEN?.trim() || null
    const kitConfigured = Boolean(
      process.env.CONVERT_KIT_V4_API_KEY || process.env.CONVERT_KIT_API_KEY
    )
    const missing: string[] = []
    if (!typeformToken) missing.push('TYPEFORM_PERSONAL_ACCESS_TOKEN')
    if (formIds.length === 0) {
      missing.push(
        'NEXT_PUBLIC_TYPEFORM_CITIZEN_SHORT_FORM_ID, NEXT_PUBLIC_TYPEFORM_CITIZEN_FORM_ID, NEXT_PUBLIC_TYPEFORM_CITIZEN_EMAIL_FORM_ID'
      )
    }
    if (!kitConfigured) missing.push('CONVERT_KIT_V4_API_KEY or CONVERT_KIT_API_KEY')

    if (missing.length > 0) {
      return res.status(503).json({
        ok: false,
        dryRun: true,
        readOnly: true,
        missing,
        positionCounts: positions,
        buckets: null,
        message:
          'Window counts come from chain reads. Email buckets were not computed because a required secret is missing.',
      })
    }

    const exclusions = await loadExclusions(true)
    const assembled = await assembleCoverageInputs({
      profiles,
      expiresAt,
      nowMs,
      formIds,
      typeformToken,
      kitConfigured: true,
      exclusions,
    })
    if (!assembled.ok) {
      return res
        .status(503)
        .json({ ok: false, dryRun: true, error: assembled.error, positionCounts: positions })
    }

    const report = buildRenewalCoverageReport(assembled.rows, nowMs, {
      enterToday: positions.enterToday,
      inside: positions.inside,
      expiredWithin14: positions.expiredWithin14,
      outOfWindow: positions.outOfWindow,
    })

    console.log(
      '[citizen-renewal-dry-run]',
      JSON.stringify({
        counts: report.counts,
        expiryUnknown: positions.unknown,
        warnings: exclusions.warnings,
      })
    )

    return res.status(200).json({
      ...report,
      expiryUnknown: assembled.expiryUnknown,
      exclusions: {
        suppressionChecked: exclusions.suppressionChecked,
        firstRunRedisChecked: exclusions.firstRunRedisChecked,
        firstRunRedisKey: 'renewal:exclude:first-run',
        suppressionKey: 'renewal:suppress',
        kitTagChecked: exclusions.kitTagChecked,
        kitTagId: exclusions.kitTagId,
        warnings: exclusions.warnings,
      },
    })
  } catch (error) {
    console.error('[citizen-renewal-dry-run]', error)
    return res.status(500).json({
      ok: false,
      dryRun: true,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
