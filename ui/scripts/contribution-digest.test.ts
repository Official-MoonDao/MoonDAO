/// <reference types="node" />
import { expect } from 'chai'
import type { Contribution } from '../lib/contributions/getSheetContributions'
import {
  buildDailyDigestContent,
  buildLookbackContent,
  decideDigest,
  formatContributorLine,
  generateDigestIntro,
  groupByContributor,
  MAX_LISTED_CONTRIBUTORS,
  sanitizeIntro,
  topAreas,
} from '../lib/contributions/dailyDigest'

function entry(over: Partial<Contribution>): Contribution {
  return {
    timestamp: '2026-11-22T15:00:00.000Z',
    walletAddress: '0x' + 'a'.repeat(40),
    name: 'Gabriel Matheus',
    description: 'Attended the weekly town hall',
    links: '',
    area: 'Community Growth & Engagement',
    title: 'Town Hall 11/19',
    ...over,
  }
}

const DAY = 24 * 60 * 60

describe('contribution digest', () => {
  describe('decideDigest', () => {
    const nowS = 1_800_000_000

    it('posts a daily digest when there is something new', () => {
      expect(decideDigest({ newCount: 3, nowS, lastRunS: nowS - DAY, lastLookbackS: null })).to.deep.equal({
        kind: 'daily',
      })
    })

    it('skips a rerun within 20 hours unless forced', () => {
      const base = { newCount: 3, nowS, lastRunS: nowS - 2 * 60 * 60, lastLookbackS: null }
      expect(decideDigest(base)).to.deep.equal({ kind: 'skip', reason: 'already-posted' })
      expect(decideDigest({ ...base, force: true })).to.deep.equal({ kind: 'daily' })
    })

    it('posts a look-back on a quiet day only once a week', () => {
      const quiet = { newCount: 0, nowS, lastRunS: nowS - DAY }
      expect(decideDigest({ ...quiet, lastLookbackS: null })).to.deep.equal({ kind: 'lookback' })
      expect(decideDigest({ ...quiet, lastLookbackS: nowS - 3 * DAY })).to.deep.equal({
        kind: 'skip',
        reason: 'quiet-day',
      })
      expect(decideDigest({ ...quiet, lastLookbackS: nowS - 7 * DAY })).to.deep.equal({
        kind: 'lookback',
      })
    })
  })

  describe('grouping and lines', () => {
    it('groups by wallet and keeps first-seen order', () => {
      const groups = groupByContributor([
        entry({ title: 'A' }),
        entry({ walletAddress: '0x' + 'b'.repeat(40), name: 'Maria', title: 'B', area: 'Other' }),
        entry({ title: 'C', area: 'Content Creation & Marketing' }),
      ])
      expect(groups.map((g) => g.name)).to.deep.equal(['Gabriel Matheus', 'Maria'])
      expect(groups[0].titles).to.deep.equal(['A', 'C'])
      expect(formatContributorLine(groups[0])).to.equal(
        '• **Gabriel Matheus** — A (+1 more) · Community Growth & Engagement'
      )
    })

    it('escapes markdown in user-entered names and titles', () => {
      const [g] = groupByContributor([entry({ name: 'Kyle *Longarm*', title: '# heading_one' })])
      expect(formatContributorLine(g)).to.contain('Kyle \\*Longarm\\*')
      expect(formatContributorLine(g)).to.contain('\\# heading\\_one')
    })

    it('ranks top areas by count', () => {
      expect(
        topAreas([entry({ area: 'X' }), entry({ area: 'Y' }), entry({ area: 'Y' }), entry({ area: 'Z' })], 2)
      ).to.deep.equal(['Y', 'X'])
    })
  })

  describe('buildDailyDigestContent', () => {
    it('includes counts, intro, list and link', () => {
      const content = buildDailyDigestContent(
        [entry({}), entry({ walletAddress: '0x' + 'b'.repeat(40), name: 'Maria', title: 'Colombia' })],
        'A busy day.'
      )
      expect(content).to.contain('2 contributions from 2 citizens')
      expect(content).to.contain('A busy day.')
      expect(content).to.contain('**Maria** — Colombia')
      expect(content).to.match(/<https?:\/\/[^>]+\/contributions>/)
    })

    it('uses singular wording and works without an intro', () => {
      const content = buildDailyDigestContent([entry({})], null)
      expect(content).to.contain('1 contribution from 1 citizen**')
    })

    it('caps the list and folds the rest into "more contributors"', () => {
      const many = Array.from({ length: MAX_LISTED_CONTRIBUTORS + 3 }, (_, i) =>
        entry({ walletAddress: '0x' + String(i).padStart(40, '0'), name: `Citizen ${i}` })
      )
      const content = buildDailyDigestContent(many, null)
      expect(content).to.contain(`**Citizen ${MAX_LISTED_CONTRIBUTORS - 1}**`)
      expect(content).not.to.contain(`**Citizen ${MAX_LISTED_CONTRIBUTORS}**`)
      expect(content).to.contain('…and 3 more contributors')
    })

    it('stays under Discord’s limit with very long titles', () => {
      const many = Array.from({ length: 10 }, (_, i) =>
        entry({
          walletAddress: '0x' + String(i).padStart(40, '0'),
          name: 'N'.repeat(200),
          title: 'T'.repeat(500),
          area: 'A'.repeat(100),
        })
      )
      expect(buildDailyDigestContent(many, 'x'.repeat(400)).length).to.be.at.most(1900)
    })
  })

  describe('buildLookbackContent', () => {
    it('summarizes the week with a call to action', () => {
      const content = buildLookbackContent([entry({}), entry({ title: 'Second' })], null)
      expect(content).to.contain('The last 7 days')
      expect(content).to.contain('2 contributions from 1 citizen')
      expect(content).to.contain('mostly Community Growth & Engagement')
      expect(content).to.contain('Log it →')
    })

    it('still posts a call to action on an empty week', () => {
      const content = buildLookbackContent([], null)
      expect(content).to.contain('quiet week')
      expect(content).to.contain('Log it →')
    })
  })

  describe('sanitizeIntro', () => {
    it('strips links, mentions and markdown', () => {
      expect(
        sanitizeIntro('Great work @everyone! See [this](https://evil.example) and https://x.com/y <@123> # hi')
      ).to.equal('Great work everyone! See this and 123 hi')
    })

    it('rejects empty or non-string output and caps length', () => {
      expect(sanitizeIntro('')).to.equal(null)
      expect(sanitizeIntro(42)).to.equal(null)
      expect(sanitizeIntro('A sentence here. '.repeat(60))!.length).to.be.at.most(400)
    })
  })

  describe('generateDigestIntro', () => {
    const ok = (content: string) => async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content } }] }),
    })

    it('returns the sanitized intro from Groq JSON', async () => {
      const intro = await generateDigestIntro({
        kind: 'daily',
        entries: [entry({})],
        apiKey: 'k',
        fetchImpl: ok('{"intro":"Town halls were the theme @here https://x.co"}'),
      })
      expect(intro).to.equal('Town halls were the theme here')
    })

    it('returns null without a key, on errors, or on bad JSON', async () => {
      expect(await generateDigestIntro({ kind: 'daily', entries: [entry({})], apiKey: undefined })).to.equal(null)
      expect(
        await generateDigestIntro({
          kind: 'daily',
          entries: [entry({})],
          apiKey: 'k',
          fetchImpl: async () => ({ ok: false, json: async () => ({ error: { message: 'rate limited' } }) }),
        })
      ).to.equal(null)
      expect(
        await generateDigestIntro({ kind: 'daily', entries: [entry({})], apiKey: 'k', fetchImpl: ok('not json') })
      ).to.equal(null)
      expect(
        await generateDigestIntro({
          kind: 'daily',
          entries: [entry({})],
          apiKey: 'k',
          fetchImpl: async () => {
            throw new Error('timeout')
          },
        })
      ).to.equal(null)
    })
  })
})
