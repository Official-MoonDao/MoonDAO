/// <reference types="node" />
import { expect } from 'chai'
import fs from 'fs'
import path from 'path'
import {
  FIRST_RUN_ANNOUNCE_WINDOW_MS,
  isWithinAnnounceWindow,
  parseContributionTimestamp,
} from '../lib/contributions/notifyNewContributions'

describe('contribution Discord announce window', () => {
  const now = Date.UTC(2026, 9, 6, 22, 0, 0) // 2026-10-06T22:00:00Z

  it('parses the Google Sheet timestamp format', () => {
    expect(parseContributionTimestamp('10/6/2026 15:44:02')).to.equal(
      Date.UTC(2026, 9, 6, 15, 44, 2)
    )
    expect(parseContributionTimestamp('4/9/2026 1:53:53')).to.equal(Date.UTC(2026, 3, 9, 1, 53, 53))
    expect(parseContributionTimestamp('10/6/2026 8:11:42 PM')).to.equal(
      Date.UTC(2026, 9, 6, 20, 11, 42)
    )
  })

  it('rejects timestamps that are not real dates', () => {
    expect(parseContributionTimestamp('')).to.equal(null)
    expect(parseContributionTimestamp('not a date')).to.equal(null)
    expect(parseContributionTimestamp('13/40/2026 10:00:00')).to.equal(null)
    expect(parseContributionTimestamp('2/31/2026 10:00:00')).to.equal(null)
  })

  it('announces the last 14 days on the first poll and seeds older rows', () => {
    expect(isWithinAnnounceWindow('10/6/2026 8:11:42', now)).to.equal(true)
    expect(isWithinAnnounceWindow('9/23/2026 0:00:00', now)).to.equal(true)
    expect(isWithinAnnounceWindow('9/22/2026 21:00:00', now)).to.equal(false)
    expect(isWithinAnnounceWindow('4/9/2026 1:53:53', now)).to.equal(false)
    expect(isWithinAnnounceWindow('nonsense', now)).to.equal(false)
    expect(FIRST_RUN_ANNOUNCE_WINDOW_MS).to.equal(14 * 24 * 60 * 60 * 1000)
  })
})

describe('contribution notification cron', () => {
  const workflow = fs.readFileSync(
    path.join(__dirname, '../../.github/workflows/contribution-notifications.yml'),
    'utf8'
  )

  it('posts to www so the apex 307 cannot swallow the poll', () => {
    expect(workflow).to.include('https://www.moondao.com')
    expect(workflow).to.not.match(/BASE="\$\{SITE_URL:-https:\/\/moondao\.com\}"/)
    expect(workflow).to.include('http://moondao.com|https://moondao.com')
  })

  it('fails the job unless the notifier reports ok', () => {
    expect(workflow).to.include('"ok":true')
    expect(workflow).to.include('exit 1')
  })
})
