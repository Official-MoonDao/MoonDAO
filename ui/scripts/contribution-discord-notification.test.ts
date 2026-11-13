/// <reference types="node" />
import { expect } from 'chai'
import fs from 'fs'
import path from 'path'
import type { Contribution } from '../lib/contributions/getSheetContributions'
import {
  buildContent,
  FIRST_RUN_ANNOUNCE_WINDOW_MS,
  isWithinAnnounceWindow,
  parseContributionTimestamp,
  suppressLinkPreviews,
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

describe('contribution Discord link previews', () => {
  it('brackets bare URLs so Discord shows no preview', () => {
    expect(suppressLinkPreviews('https://www.youtube.com/watch?v=DczVqy4fAYQ')).to.equal(
      '<https://www.youtube.com/watch?v=DczVqy4fAYQ>'
    )
    expect(suppressLinkPreviews('see https://a.com/x, and http://b.org.')).to.equal(
      'see <https://a.com/x>, and <http://b.org>.'
    )
  })

  it('leaves already-bracketed URLs alone', () => {
    expect(suppressLinkPreviews('<https://a.com/x>')).to.equal('<https://a.com/x>')
  })

  it('handles masked links and wiki-style parens', () => {
    expect(suppressLinkPreviews('[demo](https://a.com/x)')).to.equal('[demo](<https://a.com/x>)')
    expect(suppressLinkPreviews('https://en.wikipedia.org/wiki/Moon_(disambiguation)')).to.equal(
      '<https://en.wikipedia.org/wiki/Moon_(disambiguation)>'
    )
    expect(suppressLinkPreviews('**https://a.com**')).to.equal('**<https://a.com>**')
  })

  it('brackets every link in the announcement, including ours', () => {
    const content = buildContent({
      name: 'Ada',
      title: 'Lunar demo',
      area: 'Media',
      description: 'Watch https://youtu.be/abc and read https://blog.example.com/post.',
      links: 'www.example.com/video',
      walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
      timestamp: '10/6/2026 15:44:02',
    } as Contribution)
    expect(content).to.include('<https://youtu.be/abc>')
    expect(content).to.include('<https://blog.example.com/post>.')
    expect(content).to.include('🔗 <https://www.example.com/video>')
    expect(content).to.match(/View all contributions → <https?:\/\/[^\s>]+\/contributions>/)
    expect(content).to.not.match(/(^|[^<])https?:\/\//m)
  })
})
