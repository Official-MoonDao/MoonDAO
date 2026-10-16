/// <reference types="node" />
import { expect } from 'chai'
import fs from 'fs'
import path from 'path'
import {
  ARBITRUM_CITIZEN_NFT,
  buildRenewalCoverageReport,
  countWindowPositions,
  expectedSequencePosition,
  futureKitAddPlan,
  KitResubscribeBlocked,
  kitSubscriberLookupPath,
  renewalCountsComplete,
  renewalDedupeKey,
  renewalDryRunSources,
  windowPosition,
} from '../lib/citizen/renewalCoverage'

const NOW = Date.UTC(2026, 9, 7)
const NOW_SEC = NOW / 1000
const DAY = 24 * 60 * 60

function expiresIn(days: number): number {
  return NOW_SEC + days * DAY
}

describe('renewal window position', () => {
  it('splits citizens into enter today, inside, expired within 14, and out of window', () => {
    expect(windowPosition(expiresIn(30), NOW)).to.equal('enterToday')
    expect(windowPosition(expiresIn(29), NOW)).to.equal('inside')
    expect(windowPosition(expiresIn(1), NOW)).to.equal('inside')
    expect(windowPosition(expiresIn(0), NOW)).to.equal('expiredWithin14')
    expect(windowPosition(expiresIn(-14), NOW)).to.equal('expiredWithin14')
    expect(windowPosition(expiresIn(31), NOW)).to.equal('outOfWindow')
    expect(windowPosition(expiresIn(-15), NOW)).to.equal('outOfWindow')
  })

  it('counts each position, including citizens outside the window', () => {
    const counts = countWindowPositions(
      [expiresIn(30), expiresIn(10), expiresIn(-3), expiresIn(90), null],
      NOW
    )
    expect(counts.enterToday).to.equal(1)
    expect(counts.inside).to.equal(1)
    expect(counts.expiredWithin14).to.equal(1)
    expect(counts.outOfWindow).to.equal(1)
    expect(counts.unknown).to.equal(1)
  })

  it('places a late entrant on the sequence day they would have reached from day -30', () => {
    const twentyDaysLeft = expectedSequencePosition(20)
    expect(twentyDaysLeft.sequenceDay).to.equal(10)
    expect(twentyDaysLeft.missedEmails).to.deep.equal(['minus30'])
    expect(twentyDaysLeft.nextEmail).to.equal('minus14')

    const expiryDay = expectedSequencePosition(0)
    expect(expiryDay.sequenceDay).to.equal(30)
    expect(expiryDay.nextEmail).to.equal('expiry')
    expect(expiryDay.missedEmails).to.deep.equal(['minus30', 'minus14'])

    const winBack = expectedSequencePosition(-14)
    expect(winBack.sequenceDay).to.equal(44)
    expect(winBack.nextEmail).to.equal('plus14')
  })
})

describe('renewal dedupe key', () => {
  it('is one key per citizen per expiry term', () => {
    expect(renewalDedupeKey('42', 1800000000)).to.equal('renewal:42:1800000000')
  })

  it('rejects a non-numeric token id', () => {
    expect(() => renewalDedupeKey('42a', 1800000000)).to.throw('tokenId')
  })
})

describe('Kit resubscribe guard', () => {
  it('refuses to plan an add for unsubscribed, cancelled, bounced, or complained subscribers', () => {
    for (const state of ['unsubscribed', 'cancelled', 'bounced', 'complained']) {
      expect(() => futureKitAddPlan(state)).to.throw(KitResubscribeBlocked)
    }
  })

  it('describes a direct subscriber create for a new address and does not execute it', () => {
    const plan = futureKitAddPlan(null, 'person@example.com', '42')
    expect(plan.executed).to.equal(false)
    expect(plan.action).to.equal('create-later')
    expect(plan.request?.method).to.equal('POST')
    expect(plan.request?.url).to.equal('https://api.kit.com/v4/subscribers')
    expect(plan.request?.url).to.not.include('/forms/')
    expect(plan.doNotCall.join(' ')).to.include('/forms/')
    expect(plan.request?.body.email_address).to.equal('person@example.com')
  })

  it('does not plan a create for someone who is already active', () => {
    const plan = futureKitAddPlan('active')
    expect(plan.executed).to.equal(false)
    expect(plan.action).to.equal('already-active')
    expect(plan.request).to.equal(null)
  })

  it('looks up Kit subscribers with status=all so cancelled addresses are visible', () => {
    const path = kitSubscriberLookupPath(['A@Example.com'])
    expect(path).to.include('status=all')
    expect(path.startsWith('/v4/subscribers?')).to.equal(true)
  })
})

describe('renewal coverage report', () => {
  const rows = [
    {
      tokenId: '1',
      expiresAt: expiresIn(30),
      email: 'active@example.com',
      kitState: 'active',
      suppressed: false,
      firstRunRedis: true,
      firstRunKitTag: false,
    },
    {
      tokenId: '2',
      expiresAt: expiresIn(12),
      email: 'new@example.com',
      kitState: null,
      suppressed: false,
      firstRunRedis: false,
      firstRunKitTag: true,
    },
    {
      tokenId: '3',
      expiresAt: expiresIn(-2),
      email: 'gone@example.com',
      kitState: 'cancelled',
      suppressed: false,
      firstRunRedis: true,
      firstRunKitTag: false,
    },
    {
      tokenId: '4',
      expiresAt: expiresIn(5),
      email: null,
      kitState: null,
      suppressed: false,
      firstRunRedis: false,
      firstRunKitTag: false,
    },
    {
      tokenId: '5',
      expiresAt: expiresIn(200),
      email: 'later@example.com',
      kitState: 'active',
      suppressed: false,
      firstRunRedis: false,
      firstRunKitTag: false,
    },
  ]

  it('keeps the four eligibility buckets and lists first-run overlap separately', () => {
    const report = buildRenewalCoverageReport(rows, NOW, {
      enterToday: 1,
      inside: 2,
      expiredWithin14: 1,
      outOfWindow: 1,
    })

    expect(report.counts.activeKit).to.equal(1)
    expect(report.counts.typeformOnly).to.equal(1)
    expect(report.counts.excluded).to.equal(1)
    expect(report.counts.noEmail).to.equal(1)
    expect(report.counts.positions.outOfWindow).to.equal(1)
    expect(report.buckets.noEmail[0].tokenId).to.equal('4')
    expect(report.buckets.noEmail[0].exclusionReason).to.equal('no-email')
    expect(report.buckets.excluded[0].exclusionReason).to.equal('kit-cancelled')
    expect(report.firstRunOverlap.map((row) => row.tokenId)).to.deep.equal(['1', '2'])
    expect(report.buckets.activeKit[0].emailMasked).to.equal('a***@example.com')
    expect(report.buckets.activeKit[0].dedupeKey).to.equal(`renewal:1:${expiresIn(30)}`)
    expect(report.buckets.activeKit[0].position).to.equal('enterToday')
    expect(report.buckets.activeKit[0].catchUp).to.equal(null)
    expect(report.buckets.typeformOnly[0].position).to.equal('inside')
    expect(report.buckets.typeformOnly[0].daysToExpiry).to.equal(12)
    expect(report.buckets.typeformOnly[0].lateEntrant).to.equal(true)
    expect(report.buckets.typeformOnly[0].catchUp).to.be.a('string')
    expect(JSON.stringify(report)).to.not.include('active@example.com')
    expect(JSON.stringify(report)).to.not.include('gone@example.com')
  })
})

describe('renewal dry run stays read-only', () => {
  const root = path.join(__dirname, '..')
  const route = fs.readFileSync(
    path.join(root, 'pages/api/cron/citizen-renewal-reminders.ts'),
    'utf8'
  )
  const reads = fs.readFileSync(path.join(root, 'lib/citizen/renewalCoverageRead.ts'), 'utf8')

  it('does not send mail or post to Kit from the route or the read module', () => {
    const source = `${route}\n${reads}`
    expect(source).to.not.include('sendMail')
    expect(source).to.not.include('nodemailer')
    expect(source).to.not.include('api.kit.com/v4/forms')
    expect(source).to.not.include('api.convertkit.com/v3/forms')
    expect(source).to.not.include("method: 'POST'")
    expect(source).to.not.include('method: "POST"')
    expect(reads).to.include("method: 'GET'")
  })

  it('reads the Arbitrum citizen NFT from the plan', () => {
    expect(ARBITRUM_CITIZEN_NFT).to.equal('0x6E464F19e0fEF3DB0f3eF9FD3DA91A297DbFE002')
    expect(reads).to.include('ARBITRUM_CITIZEN_NFT')
  })

  it('reads Multicall3 aggregate3 with callStatic so ethers does not send a transaction', () => {
    expect(reads).to.include('multicall.callStatic.aggregate3(')
    expect(reads).to.not.include('multicall.aggregate3(')
    expect(reads).to.include(
      'function aggregate3((address target, bool allowFailure, bytes callData)[] calls) view returns ((bool success, bytes returnData)[] returnData)'
    )
    expect(reads).to.not.include('payable')
    expect(reads).to.not.include('sendTransaction')
    expect(reads).to.include("method: 'GET'")
    const contractCalls = reads.match(/new ethers\.Contract/g) || []
    expect(contractCalls).to.have.length(1)
  })

  it('marks email bucket counts incomplete unless Typeform and Kit were read', () => {
    expect(route).to.include('countsComplete')
    expect(route).to.include('sources: dryRunSources(read)')
    expect(route).to.include('buckets: null')
    expect(route).to.include('INCOMPLETE_COUNTS')
    expect(renewalCountsComplete({ typeform: true, kit: true })).to.equal(true)
    expect(renewalCountsComplete({ typeform: false, kit: true })).to.equal(false)
    expect(renewalCountsComplete({ typeform: true, kit: false })).to.equal(false)
  })
})

describe('renewal dry-run sources', () => {
  it('is booleans only and never includes env values', () => {
    const typeformToken = 'tf_pat_do_not_leak'
    const kitKey = 'kit_key_do_not_leak'
    const redisUrl = 'https://example.upstash.io'
    const redisToken = 'redis_token_do_not_leak'
    const shortForm = 'shortFormId'
    const longForm = 'longFormId'
    const sources = renewalDryRunSources(
      {
        TYPEFORM_PERSONAL_ACCESS_TOKEN: typeformToken,
        CONVERT_KIT_V4_API_KEY: '   ',
        CONVERT_KIT_API_KEY: kitKey,
        UPSTASH_REDIS_URL: redisUrl,
        UPSTASH_REDIS_TOKEN: redisToken,
        NEXT_PUBLIC_TYPEFORM_CITIZEN_SHORT_FORM_ID: shortForm,
        NEXT_PUBLIC_TYPEFORM_CITIZEN_FORM_ID: longForm,
        NEXT_PUBLIC_TYPEFORM_CITIZEN_EMAIL_FORM_ID: '',
      },
      {
        tableland: true,
        arbitrumExpiresAt: false,
        typeform: false,
        kit: false,
        firstRunExclusion: true,
      }
    )

    expect(sources).to.deep.equal({
      TYPEFORM_PERSONAL_ACCESS_TOKEN: true,
      CONVERT_KIT_V4_API_KEY: false,
      CONVERT_KIT_API_KEY: true,
      UPSTASH_REDIS_URL: true,
      UPSTASH_REDIS_TOKEN: true,
      NEXT_PUBLIC_TYPEFORM_CITIZEN_SHORT_FORM_ID: true,
      NEXT_PUBLIC_TYPEFORM_CITIZEN_FORM_ID: true,
      NEXT_PUBLIC_TYPEFORM_CITIZEN_EMAIL_FORM_ID: false,
      tableland: true,
      arbitrumExpiresAt: false,
      typeform: false,
      kit: false,
      'renewal:exclude:first-run': true,
    })
    for (const value of Object.values(sources)) {
      expect(value).to.be.a('boolean')
    }
    const encoded = JSON.stringify(sources)
    for (const secret of [typeformToken, kitKey, redisUrl, redisToken, shortForm, longForm]) {
      expect(encoded).to.not.include(secret)
    }
    expect(renewalCountsComplete(sources)).to.equal(false)
  })
})

describe('renewal dry-run workflow', () => {
  const workflow = fs.readFileSync(
    path.join(__dirname, '../../.github/workflows/citizen-renewal-dry-run.yml'),
    'utf8'
  )

  it('is manual only and calls the dry-run route', () => {
    expect(workflow).to.include('workflow_dispatch')
    expect(workflow).to.not.include('schedule:')
    expect(workflow).to.include('dryRun=1')
    expect(workflow).to.include('GITHUB_STEP_SUMMARY')
  })
})
