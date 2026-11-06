/**
 * Unit tests for feature logic that the component suite does not exercise.
 * No network. Each describe is one feature.
 */
import { expect } from 'chai'
import { BigNumber } from 'ethers'
import { parseLocationData, locationGroupKey } from '@/lib/citizen/citizenDataService'
import { generateInviteToken } from '@/lib/citizen/inviteTokens'
import { isValidContributorEmail } from '@/lib/contribution/validateContributorEmail'
import { contributionGasSponsorKey } from '@/lib/contributions/contributionGas'
import { newsletterClientIp } from '@/lib/convert-kit/subscribeRateLimit'
import { getHumanTime } from '@/lib/dashboard/dashboard-utils.ts/getHumanTime'
import { parseAnnouncementText } from '@/lib/dashboard/dashboard-utils.ts/parseAnnouncementText'
import {
  BET_EVENT_SIGNATURE,
  FUNDING_EVENT_SIGNATURE,
  TRADE_EVENT_SIGNATURE,
} from '@/lib/deprize/eventSignatures'
import { parseBookParams } from '@/lib/forecasts/bookParams'
import { hatTreeMatches } from '@/lib/hats/hatTreeMatches'
import {
  isPendingImageJobStale,
  markPendingImageJobPolling,
  markPendingImageJobUploading,
  PENDING_IMAGE_JOB_TTL_MS,
  readPendingImageJob,
  clearPendingImageJob,
} from '@/lib/image-generator/pendingImageJob'
import {
  calculateRedeemValue,
  calculateTokensFromPayment,
  formatTokenAmount,
} from '@/lib/juicebox/tokenCalculations'
import { stationOffsetM } from '@/lib/lunar-atlas/skyplan'
import { pickChainWithMaxNativeBalance } from '@/lib/mission/contributeModalDefaultChain'
import { formatEthFiveSigFigs } from '@/lib/mission/formatEthFiveSigFigs'
import { formatUsdCompact, milestoneSegmentProgress } from '@/lib/mission/milestoneProgress'
import formatPressDate, { pressYear } from '@/lib/press/formatPressDate'
import { getLinkedEvmAddresses } from '@/lib/privy/linkedEvmAddresses'
import { getProjectDisplayName, isUntitledLike } from '@/lib/project/getProjectDisplayName'
import { parseCycleParams } from '@/lib/proposals/parseCycleParams'
import { arbitrum, arbitrumSepolia, base, ethereum } from '@/lib/rpc/chains'
import { parseSafeTxGas, resolveSafeExecutionGasLimit } from '@/lib/safe/executionGas'
import { citizenRowToNFT, teamRowToNFT } from '@/lib/tableland/convertRow'
import {
  getIncrementalCache,
  getSimpleCache,
  hashObject,
  setSimpleCache,
  updateIncrementalCache,
  withIncrementalCache,
  withSimpleCache,
} from '@/lib/treasury/incrementalCache'
import { answerByFieldId } from '@/lib/typeform/answerByFieldId'
import { formatCitizenFormData, formatCitizenShortFormData } from '@/lib/typeform/citizenFormData'
import formatTeamFormData from '@/lib/typeform/teamFormData'
import { getBlocksInTimeframe } from '@/lib/utils/blocks'
import {
  daysUntilDay,
  endOfConfigDeadline,
  formatQuarterCycleLabel,
  formatSubmissionWindowClose,
  formatTimeUntilDeadline,
  getThirdThursdayOfQuarterTimestamp,
  submissionWindowClosesAt,
} from '@/lib/utils/dates'
import { isSerializedFile } from '@/lib/utils/files'
import { getAttribute } from '@/lib/utils/nft'
import {
  formatContributionOutput,
  formatNumberWithCommas,
  formatNumberWithCommasAndDecimals,
  fromWad,
  NumberType,
  stringToNumber,
  transformNumber,
  truncateTokenValue,
  wadToFloat,
} from '@/lib/utils/numbers'
import { getBudget, normalizeJsonString } from '@/lib/utils/rewards'
import {
  addHttpsIfMissing,
  bufferToHex,
  bytesOfString,
  removeMarkdownFormatting,
  tokenSymbolText,
} from '@/lib/utils/strings'
import { daysFromNowTimestamp, formatHistoricalDate, secondsToMS } from '@/lib/utils/timestamp'
import {
  formatStageDisplay,
  getCurrentLevel,
  getHighestQualifyingStage,
  getNextUnclamedThreshold,
  getProgressSummary,
  getProgressThreshold,
  type StagedQuestProgress,
} from '@/lib/xp/staged-quest-info'
import { payoutMultiple } from '@/components/deprize/MarketOutcomeRow'
import { ordinal } from '@/components/elections/RankedBallot'
import { hasFinalReport } from '@/components/project/PastProjects'

const DAY = 24 * 60 * 60 * 1000
const ADDRESS = '0x' + 'ab'.repeat(20)

function withNow(at: number, run: () => void) {
  const real = Date.now
  Date.now = () => at
  try {
    run()
  } finally {
    Date.now = real
  }
}

function answer(id: string, fields: Record<string, unknown>) {
  return { field: { id }, ...fields }
}

function quest(partial: Partial<StagedQuestProgress>): StagedQuestProgress {
  return {
    stages: [],
    userHighestStage: 0,
    currentUserMetric: 0,
    nextClaimableStage: null,
    nextStageThreshold: null,
    nextStageXP: null,
    totalClaimableXP: 0,
    progressToNext: 0,
    isMaxStageReached: false,
    ...partial,
  }
}

describe('project display names', () => {
  it('treats blank and Untitled headings as missing', () => {
    expect(isUntitledLike(null)).to.equal(true)
    expect(isUntitledLike('  ')).to.equal(true)
    expect(isUntitledLike('Untitled project')).to.equal(true)
    expect(isUntitledLike('My Untitled draft')).to.equal(false)
  })

  it('prefers a real project name, then the proposal title, then the body', () => {
    expect(getProjectDisplayName({ name: 'Habitat printer' } as any)).to.equal('Habitat printer')
    expect(
      getProjectDisplayName({ name: 'Untitled' } as any, { title: 'Printer', body: '# Ignored' })
    ).to.equal('Printer')
    expect(
      getProjectDisplayName({ name: '' } as any, {
        title: 'Untitled',
        body: '# Untitled\n\nAuthor: Ada\n\nPlease read the template\n\nA real first line',
      })
    ).to.equal('A real first line')
  })

  it('cleans markdown and cuts a runaway line at 200 characters', () => {
    const long = 'A'.repeat(210)
    expect(
      getProjectDisplayName({ name: 'untitled' } as any, {
        body: `[${long}](https://example.com)`,
      })
    ).to.equal('A'.repeat(200))
    expect(
      getProjectDisplayName({ name: 'untitled' } as any, {
        body: '![photo](https://example.com/a.png)',
      })
    ).to.equal('photo')
  })

  it('falls back when nothing usable is stored', () => {
    expect(getProjectDisplayName(null)).to.equal('Untitled Project')
    expect(getProjectDisplayName({ name: 'Untitled' } as any, { title: '', body: '# ' })).to.equal(
      'Untitled Project'
    )
  })
})

describe('mission funding display', () => {
  const milestones = [
    { usd: 5_000, label: 'b' },
    { usd: 1_000, label: 'a' },
  ] as any

  it('measures progress inside the current leg and sorts milestones', () => {
    expect(milestoneSegmentProgress(0, []).allMilestonesComplete).to.equal(false)
    const start = milestoneSegmentProgress(250, milestones)
    expect(start).to.include({
      progressPercent: 25,
      segmentStartUsd: 0,
      segmentEndUsd: 1_000,
      nextMilestoneIndex: 0,
      allMilestonesComplete: false,
    })
    const mid = milestoneSegmentProgress(3_000, milestones)
    expect(mid.progressPercent).to.equal(50)
    expect(mid.segmentStartUsd).to.equal(1_000)
    expect(milestoneSegmentProgress(5_000, milestones).allMilestonesComplete).to.equal(true)
    expect(milestoneSegmentProgress(9_000, milestones).progressPercent).to.equal(100)
  })

  it('compacts dollars the way the milestone bar labels them', () => {
    expect(formatUsdCompact(999)).to.equal('$999')
    expect(formatUsdCompact(1_000)).to.equal('$1K')
    expect(formatUsdCompact(1_500)).to.equal('$2K')
    expect(formatUsdCompact(1_000_000)).to.equal('$1M')
    expect(formatUsdCompact(2_400_000)).to.equal('$2.4M')
  })

  it('prints ETH with five significant figures and refuses non-amounts', () => {
    expect(formatEthFiveSigFigs(0)).to.equal('0')
    expect(formatEthFiveSigFigs(Number.NaN)).to.equal('0')
    expect(formatEthFiveSigFigs(-0.1)).to.equal('0')
    expect(formatEthFiveSigFigs(12345.678)).to.equal('12,346')
    expect(formatEthFiveSigFigs(0.000123456)).to.equal('0.00012346')
  })
})

describe('contributor email', () => {
  it('accepts a trimmed address and rejects everything else', () => {
    expect(isValidContributorEmail('  ada@moondao.com  ')).to.equal(true)
    expect(isValidContributorEmail('ada@moondao.com')).to.equal(true)
    expect(isValidContributorEmail(null)).to.equal(false)
    expect(isValidContributorEmail('not-an-email')).to.equal(false)
    expect(isValidContributorEmail(`${'a'.repeat(250)}@b.co`)).to.equal(false)
  })
})

describe('hat tree ids', () => {
  it('matches padded hex to the same integer and falls back to text', () => {
    expect(hatTreeMatches('0x0000000000000000000000000000000000000001', '1')).to.equal(true)
    expect(hatTreeMatches('0x10', '16')).to.equal(true)
    expect(hatTreeMatches('not-a-number', 'not-a-number')).to.equal(true)
    expect(hatTreeMatches('foo', 'bar')).to.equal(false)
  })
})

describe('forecast book params', () => {
  it('accepts either chain field and a positive integer id', () => {
    expect(parseBookParams({ chain: ' arbitrum ', deprizeId: '7' })).to.deep.equal({
      ok: true,
      chainSlug: 'arbitrum',
      deprizeId: 7,
    })
    expect(parseBookParams({ chainSlug: 'sepolia', deprizeId: 3 }).ok).to.equal(true)
    expect(parseBookParams({ deprizeId: 1 })).to.deep.equal({ ok: false, error: 'missing-chain' })
    expect(parseBookParams({ chain: 'arbitrum', deprizeId: 0 })).to.deep.equal({
      ok: false,
      error: 'missing-deprizeId',
    })
    expect(parseBookParams({ chain: 'arbitrum', deprizeId: 1.5 }).ok).to.equal(false)
  })
})

describe('linked wallets', () => {
  it('keeps valid EVM addresses once, lowercased, and skips junk', () => {
    const addresses = getLinkedEvmAddresses(
      {
        wallet: { address: ADDRESS.toUpperCase() },
        linkedAccounts: [{ address: ADDRESS }, { address: 'not-a-wallet' }, { address: '0x123' }],
      },
      ADDRESS
    )
    expect(addresses).to.deep.equal([ADDRESS.toLowerCase()])
    expect(getLinkedEvmAddresses(null, '0x123')).to.deep.equal([])
    expect(getLinkedEvmAddresses({ linkedAccounts: 'nope' } as any, ADDRESS)).to.deep.equal([
      ADDRESS.toLowerCase(),
    ])
  })
})

describe('press dates', () => {
  it('prints only the precision that was stored', () => {
    expect(formatPressDate('2024')).to.equal('2024')
    expect(formatPressDate('2024-03')).to.equal('March 2024')
    expect(formatPressDate('2024-03-05')).to.equal('March 5, 2024')
    expect(formatPressDate('2024-13')).to.equal('2024')
    expect(pressYear('2024-03-05')).to.equal('2024')
  })
})

describe('tableland rows as NFTs', () => {
  it('fills missing team fields and keeps citizen location as JSON', () => {
    const team = teamRowToNFT({ id: 4, name: 'Aethero' })
    expect(team.metadata.name).to.equal('Aethero')
    expect(team.metadata.attributes.find((a: any) => a.trait_type === 'website').value).to.equal('')
    const citizen = citizenRowToNFT({
      id: 9,
      name: 'Ada',
      location: { lat: 1, lng: 2 },
      owner: ADDRESS,
    })
    expect(citizen.owner).to.equal(ADDRESS)
    expect(citizen.metadata.attributes[0].value).to.equal(JSON.stringify({ lat: 1, lng: 2 }))
  })
})

describe('newsletter client ip', () => {
  function req(headers: Record<string, string | string[]>, remote?: string) {
    return { headers, socket: { remoteAddress: remote } } as any
  }

  it('prefers the edge header, then the first forwarded address', () => {
    expect(
      newsletterClientIp(
        req({
          'x-vercel-proxied-for': '1.1.1.1',
          'x-forwarded-for': '9.9.9.9',
        })
      )
    ).to.equal('1.1.1.1')
    expect(newsletterClientIp(req({ 'x-forwarded-for': ' 8.8.8.8:443, 1.1.1.1 ' }))).to.equal(
      '8.8.8.8'
    )
    expect(newsletterClientIp(req({ 'cf-connecting-ip': ['::ffff:10.0.0.8'] }))).to.equal(
      '10.0.0.8'
    )
    expect(newsletterClientIp(req({}, '127.0.0.1'))).to.equal('127.0.0.1')
    expect(newsletterClientIp(req({}))).to.equal('0.0.0.0')
  })
})

describe('contribution gas sponsorship key', () => {
  it('scopes the daily cap to the chain and the lowercased wallet', () => {
    expect(contributionGasSponsorKey(42161, ADDRESS.toUpperCase())).to.equal(
      `contributions:gas:42161:${ADDRESS.toLowerCase()}`
    )
  })
})

describe('citizen portrait resume', () => {
  const store = new Map<string, string>()

  beforeEach(() => {
    store.clear()
    ;(global as any).window = {}
    ;(global as any).sessionStorage = {
      getItem: (key: string) => (store.has(key) ? store.get(key) : null),
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    }
  })

  afterEach(() => {
    delete (global as any).window
    delete (global as any).sessionStorage
  })

  it('resumes an upload, drops a polling job with no id, and expires uploads', () => {
    const started = 1_700_000_000_000
    withNow(started, () => markPendingImageJobUploading('/api/image', 'gen-1'))
    const saved = readPendingImageJob()
    expect(saved?.status).to.equal('uploading')
    expect(saved?.generationId).to.equal('gen-1')
    withNow(started + PENDING_IMAGE_JOB_TTL_MS, () => {
      expect(isPendingImageJobStale(saved!)).to.equal(false)
    })
    withNow(started + PENDING_IMAGE_JOB_TTL_MS + 1, () => {
      expect(isPendingImageJobStale(saved!)).to.equal(true)
    })

    clearPendingImageJob()
    expect(readPendingImageJob()).to.equal(null)
    withNow(started, () => markPendingImageJobPolling('job-1', 'portrait.png', '/api/image'))
    expect(readPendingImageJob()?.jobId).to.equal('job-1')
    store.set(
      'CreateCitizen_pendingImageJob',
      JSON.stringify({ apiRoute: '/api/image', startedAt: started, status: 'polling' })
    )
    expect(readPendingImageJob()).to.equal(null)
    store.set('CreateCitizen_pendingImageJob', '{')
    expect(readPendingImageJob()).to.equal(null)
  })
})

describe('staged quest progress', () => {
  const stages = [
    { threshold: BigInt(5), xpAmount: BigInt(10), active: true },
    { threshold: BigInt(10), xpAmount: BigInt(20), active: true },
    { threshold: BigInt(20), xpAmount: BigInt(40), active: false },
  ]

  it('names the stage the user is working toward, not one they already finished', () => {
    expect(formatStageDisplay(0)).to.equal('Stage 1')
    expect(getCurrentLevel(2)).to.equal(3)
    const early = quest({ stages, currentUserMetric: 0 })
    expect(getHighestQualifyingStage(early)).to.equal(1)
    expect(getNextUnclamedThreshold(early)).to.equal(5)
    const mid = quest({ stages, currentUserMetric: 7 })
    expect(getHighestQualifyingStage(mid)).to.equal(1)
    expect(getNextUnclamedThreshold(mid)).to.equal(10)
    expect(getHighestQualifyingStage(quest({ stages, currentUserMetric: 12 }))).to.equal(2)
    const done = quest({ stages, currentUserMetric: 25 })
    expect(getNextUnclamedThreshold(done)).to.equal(20)
  })

  it('holds the bar on an unclaimed stage and ignores inactive stages', () => {
    const unclaimed = quest({ stages, currentUserMetric: 12, totalClaimableXP: 20 })
    expect(getProgressThreshold(unclaimed)).to.equal(10)
    const claimed = quest({ stages, currentUserMetric: 12, totalClaimableXP: 0 })
    expect(getProgressThreshold(claimed)).to.equal(20)
    expect(getProgressSummary(quest({ isMaxStageReached: true }))).to.equal('Max level reached!')
    expect(
      getProgressSummary(
        quest({ nextClaimableStage: 0, totalClaimableXP: 15, nextStageThreshold: 10 })
      )
    ).to.equal('Ready to claim 15 XP!')
    expect(getProgressSummary(quest({ nextStageThreshold: 10, currentUserMetric: 4 }))).to.equal(
      '6 more needed for next level'
    )
  })
})

describe('typeform answers', () => {
  const answers = [
    answer('RkBAEVN40hLw', { text: 'Ada' }),
    answer('LzGGOX3e8Sfv', { email: 'ada@moondao.com' }),
    answer('W0uayCnonUN7', { boolean: true }),
    answer('14C5JA01MntJ', { text: 'Grace' }),
    answer('JEiG9XCW6M73', { email: 'grace@moondao.com' }),
    answer('ODbjYccwMg1E', { text: 'Aethero' }),
    answer('MfYME9ERpJR6', { boolean: false }),
  ]

  it('maps citizen and team fields and treats a missing view as private', () => {
    expect(answerByFieldId(answers, 'missing')).to.equal(undefined)
    const citizen = formatCitizenFormData(answers, 'resp-1')
    expect(citizen).to.include({
      name: 'Ada',
      email: 'ada@moondao.com',
      view: 'public',
      description: '',
      formResponseId: 'resp-1',
    })
    expect(formatCitizenShortFormData(answers, 'resp-2')).to.deep.equal({
      name: 'Grace',
      email: 'grace@moondao.com',
      formResponseId: 'resp-2',
    })
    const log = console.log
    console.log = () => undefined
    try {
      expect(formatTeamFormData(answers, 'resp-3').view).to.equal('private')
      expect(formatTeamFormData(answers, 'resp-3').name).to.equal('Aethero')
    } finally {
      console.log = log
    }
  })
})

describe('juicebox quotes', () => {
  it('returns zero instead of throwing when the ruleset or the amounts are missing', () => {
    expect(calculateTokensFromPayment('', [])).to.equal('0')
    expect(calculateTokensFromPayment('1', [null, null])).to.equal('0')
    expect(calculateRedeemValue('1', '0', '5')).to.equal('0')
    expect(calculateRedeemValue('nope', '1', '1')).to.equal('0')
    expect(formatTokenAmount('')).to.equal('0')
    expect(formatTokenAmount('not-a-number')).to.equal('0')
  })

  it('applies the redemption rate and trims token decimals', () => {
    const one = BigInt(10) ** BigInt(18)
    expect(calculateRedeemValue(one, one * BigInt(2), one * BigInt(4), 10000)).to.equal('2')
    expect(calculateRedeemValue(one, one * BigInt(2), one * BigInt(4), 5000)).to.equal('1')
    expect(formatTokenAmount(one + one / BigInt(2))).to.equal('1.5')
    expect(formatTokenAmount(BigInt(1_500_000), 6)).to.equal('1.5')
  })

  it('accepts a ruleset weight written in scientific notation', () => {
    const quote = calculateTokensFromPayment('1000000000000000000', [
      { weight: 1e21 },
      { reservedPercent: 0 },
    ])
    expect(quote).to.not.equal('0')
    expect(Number(quote)).to.be.greaterThan(0)
  })
})

describe('treasury caches', () => {
  it('hashes stably and serves fresh incremental rows without a refetch', async () => {
    expect(hashObject({ a: 1 })).to.equal(hashObject({ a: 1 }))
    expect(hashObject({ wallet: ADDRESS, amount: 123456789 })).to.have.length(16)
    expect(hashObject({ a: 2 })).to.not.equal(hashObject({ a: 1 }))

    const key = `unit-incremental-${Date.now()}`
    let fetches = 0
    const first = await withIncrementalCache(key, 'internalTransactions', async () => {
      fetches += 1
      return [{ id: 1, at: 10 }]
    })
    const second = await withIncrementalCache(key, 'internalTransactions', async () => {
      fetches += 1
      return [{ id: 99, at: 99 }]
    })
    expect(fetches).to.equal(1)
    expect(second).to.deep.equal(first)

    updateIncrementalCache(
      key,
      [
        { id: 1, at: 10 },
        { id: 2, at: 20 },
      ],
      {
        replace: false,
        getTimestamp: (row: { at: number }) => row.at,
      }
    )
    const cached = getIncrementalCache<{ id: number }>(key, 'internalTransactions')
    expect(cached?.data.map((row) => row.id)).to.deep.equal([1, 2])
    expect(cached?.shouldRefresh).to.equal(false)
  })

  it('marks an incremental cache stale after its window and expires a simple price', () => {
    const key = `unit-stale-${Date.now()}`
    const start = 1_700_000_000_000
    withNow(start, () => {
      updateIncrementalCache(key, [{ id: 1 }], { replace: true })
      setSimpleCache('unit-eth', 2200, 'ethPrice')
    })
    withNow(start + 6 * 60 * 60 * 1000 + 1, () => {
      expect(getIncrementalCache(key, 'internalTransactions')?.shouldRefresh).to.equal(true)
    })
    withNow(start + 60 * 1000, () => {
      expect(getSimpleCache('unit-eth', 'ethPrice')).to.equal(2200)
    })
    withNow(start + 60 * 1000 + 1, () => {
      expect(getSimpleCache('unit-eth', 'ethPrice')).to.equal(null)
    })
  })

  it('does not treat a cached zero as a miss', async () => {
    const key = `unit-zero-${Date.now()}`
    let fetches = 0
    await withSimpleCache(key, 'ethPrice', async () => {
      fetches += 1
      return 0
    })
    const again = await withSimpleCache(key, 'ethPrice', async () => {
      fetches += 1
      return 9
    })
    expect(again).to.equal(0)
    expect(fetches).to.equal(1)
  })
})

describe('number formatting', () => {
  it('truncates by token and keeps grouping', () => {
    expect(truncateTokenValue('1,234.567891', 'ETH')).to.equal('1,234.56789')
    expect(truncateTokenValue('1.239', 'USDC')).to.equal('1.24')
    expect(truncateTokenValue('1000.5', 'DAI')).to.equal('1,000.5')
    expect(truncateTokenValue(3, 'OTHER')).to.equal('3')
    expect(formatNumberWithCommas('1234.5')).to.equal('1,234.5')
    expect(formatNumberWithCommasAndDecimals('nope')).to.equal('0.00')
    expect(formatNumberWithCommasAndDecimals(1, 2)).to.equal('1.00')
  })

  it('converts wad amounts and empty inputs', () => {
    expect(stringToNumber('1.239', 2)).to.equal('1.24')
    expect(fromWad('1000000000000000000')).to.equal('1')
    expect(fromWad('1500000000000000000')).to.equal('1.5')
    expect(wadToFloat('2000000000000000000')).to.equal(2)
    expect(transformNumber(0, NumberType.bignumber).toString()).to.equal('0')
    expect(transformNumber('', NumberType.number)).to.equal(0)
    const one = transformNumber(BigNumber.from(10).pow(18), NumberType.number, 2)
    expect(one).to.equal('1.00')
  })

  it('formats contribution amounts by size', () => {
    expect(formatContributionOutput(0)).to.equal(0)
    expect(formatContributionOutput(Number.NaN)).to.equal(0)
    expect(formatContributionOutput(1.9)).to.equal('1')
    expect(formatContributionOutput(0.009)).to.equal('0.009')
    expect(formatContributionOutput(0.056)).to.equal('0.05')
    expect(formatContributionOutput(0.56)).to.equal('0.5')
  })
})

describe('nft attributes and serialized files', () => {
  it('finds a trait and rejects a payload that is not a data URL', () => {
    expect(getAttribute(null as any, 'website')).to.equal(null)
    expect(
      getAttribute([{ trait_type: 'website', value: 'https://moondao.com' }], 'website')
    ).to.deep.equal({ trait_type: 'website', value: 'https://moondao.com' })
    expect(getAttribute([{ trait_type: 'website', value: '' }], 'discord')).to.equal(undefined)
    expect(
      isSerializedFile({ name: 'a.png', type: 'image/png', data: 'data:image/png;base64,AA' })
    ).to.equal(true)
    expect(isSerializedFile({ name: 'a.png', data: 'https://example.com' })).to.equal(false)
    expect(isSerializedFile(null)).to.equal(null)
  })
})

describe('event signatures and block estimates', () => {
  it('keeps the chain event names the indexers decode', () => {
    expect(BET_EVENT_SIGNATURE).to.include('event Bet(')
    expect(BET_EVENT_SIGNATURE).to.include('address indexed bettor')
    expect(TRADE_EVENT_SIGNATURE).to.include('event AMMOutcomeTokenTrade(')
    expect(FUNDING_EVENT_SIGNATURE).to.include('event AMMFundingChanged(')
  })

  it('uses the chain block time and defaults to Arbitrum', () => {
    expect(getBlocksInTimeframe({ name: 'arbitrum' }, 15)).to.equal(225)
    expect(getBlocksInTimeframe({ name: 'ethereum' }, 1)).to.equal(5)
    expect(getBlocksInTimeframe({}, 1)).to.equal(15)
  })
})

describe('dates', () => {
  it('counts days until a weekday and closes a named deadline at the end of that UTC day', () => {
    const sunday = new Date(2026, 10, 1)
    expect(daysUntilDay(sunday, 'Sunday')).to.equal(7)
    expect(daysUntilDay(sunday, 'Monday')).to.equal(1)
    expect(() => daysUntilDay(sunday, 'Someday')).to.throw('Invalid day provided')
    expect(endOfConfigDeadline('October 8, 2026').toISOString()).to.equal(
      '2026-10-08T23:59:59.999Z'
    )
    expect(formatQuarterCycleLabel(1, 2026)).to.equal('Q1 2026')
    const thirdThursday = getThirdThursdayOfQuarterTimestamp(1, 2026)
    expect(thirdThursday.getFullYear()).to.equal(2026)
    expect(thirdThursday.getMonth()).to.equal(0)
    expect(thirdThursday.getDate()).to.equal(15)
  })

  it('labels remaining time from whole days down to a single second', () => {
    const now = Date.now()
    withNow(now, () => {
      expect(formatTimeUntilDeadline(new Date(now - 1000))).to.equal('0 SECONDS')
      expect(formatTimeUntilDeadline(new Date(now + 2 * DAY + 1000))).to.equal('2 DAYS')
      expect(formatTimeUntilDeadline(new Date(now + DAY))).to.equal('24 HOURS, 0 MINUTES')
      expect(formatTimeUntilDeadline(new Date(now + 90 * 60 * 1000))).to.equal(
        '1 HOUR, 30 MINUTES'
      )
      expect(formatTimeUntilDeadline(new Date(now + 60 * 1000))).to.equal('1 MINUTE, 0 SECONDS')
      expect(formatTimeUntilDeadline(new Date(now + 1000))).to.equal('1 SECOND')
    })
  })

  it('rejects a submission deadline that is not a calendar date', () => {
    expect(() => submissionWindowClosesAt('not a date')).to.throw('Invalid deadline date')
    const close = submissionWindowClosesAt('October 8, 2026')
    expect(formatSubmissionWindowClose(close).label).to.equal('October 9, 2026, 3:00 AM Pacific')
  })
})

describe('retro pool math and stored JSON', () => {
  it('takes five percent of non-MOONEY value and decays the MOONEY pool from Q4 2022', () => {
    const empty = getBudget([{ symbol: 'USDC', balance: 10, usd: 10 }], 2026, 1)
    expect(empty).to.deep.equal({ usdBudget: 0, mooneyBudget: 0, ethPrice: 0, usdValue: 0 })

    const tokens = [
      { symbol: 'ETH', balance: 2, usd: 6_000 },
      { symbol: 'USDC', balance: 1_000, usd: 1_000 },
      { symbol: 'stETH', balance: 1, usd: 0 },
      { symbol: 'MOONEY', balance: 5, usd: 999 },
    ]
    const budget = getBudget(tokens, 2023, 1)
    expect(budget.ethPrice).to.equal(3_000)
    expect(budget.usdValue).to.equal(10_000)
    expect(budget.usdBudget).to.equal(500)
    expect(budget.mooneyBudget).to.equal(15_000_000 * 0.95)
    expect(getBudget(tokens, 2022, 4).mooneyBudget).to.equal(15_000_000)
  })

  it('parses distribution JSON that was stored with smart quotes or bare addresses', () => {
    expect(normalizeJsonString(null)).to.deep.equal({})
    expect(normalizeJsonString([1, 2])).to.deep.equal({})
    const obj = { a: 1 }
    expect(normalizeJsonString(obj)).to.equal(obj)
    expect(normalizeJsonString('{“share”: 40}')).to.deep.equal({ share: 40 })
    expect(normalizeJsonString(`{${ADDRESS}: 25}`)).to.deep.equal({ [ADDRESS]: 25 })
    expect(normalizeJsonString('{')).to.deep.equal({})
  })
})

describe('prediction and election labels', () => {
  it('turns a probability into a payout multiple and numbers a ranked ballot', () => {
    expect(payoutMultiple(undefined)).to.equal(undefined)
    expect(payoutMultiple(0)).to.equal(undefined)
    expect(payoutMultiple(Number.NaN)).to.equal(undefined)
    expect(payoutMultiple(25)).to.equal('4.00x')
    expect(payoutMultiple(1)).to.equal('>100x')
    expect(ordinal(1)).to.equal('1st')
    expect(ordinal(2)).to.equal('2nd')
    expect(ordinal(3)).to.equal('3rd')
    expect(ordinal(4)).to.equal('4th')
    expect(ordinal(11)).to.equal('11th')
  })

  it('treats a past project as reported only when a report link exists', () => {
    expect(hasFinalReport({ finalReportIPFS: '', finalReportLink: '' } as any)).to.equal(false)
    expect(hasFinalReport({ finalReportIPFS: 'ipfs://cid' } as any)).to.equal(true)
    expect(hasFinalReport({ finalReportLink: 'https://moondao.com/report' } as any)).to.equal(true)
  })
})

describe('safe execution gas', () => {
  it('ignores a blank or non-positive safeTxGas and refuses to cap below the GS010 floor', () => {
    expect(parseSafeTxGas(undefined)).to.equal(0n)
    expect(parseSafeTxGas({ safeTxGas: '' })).to.equal(0n)
    expect(parseSafeTxGas({ safeTxGas: '0' })).to.equal(0n)
    expect(parseSafeTxGas({ safeTxGas: '-1' })).to.equal(0n)
    expect(parseSafeTxGas({ safeTxGas: 'nope' })).to.equal(0n)
    expect(parseSafeTxGas({ safeTxGas: '100' })).to.equal(100n)

    expect(resolveSafeExecutionGasLimit({ estimatedGas: 0n, isRejectionTx: false })).to.equal(
      500_000n
    )
    expect(resolveSafeExecutionGasLimit({ estimatedGas: null, isRejectionTx: true })).to.equal(
      750_000n
    )
    expect(
      resolveSafeExecutionGasLimit({ estimatedGas: 2_000_000n, isRejectionTx: false })
    ).to.equal(1_500_000n)
    const floor = resolveSafeExecutionGasLimit({
      estimatedGas: 1_000n,
      isRejectionTx: false,
      safeTxGas: 2_000_000n,
    })
    expect(floor > 1_500_000n).to.equal(true)
  })
})

describe('strings, announcements, and clocks', () => {
  it('leaves a scheme alone and strips markdown markers', () => {
    expect(addHttpsIfMissing('')).to.equal('')
    expect(addHttpsIfMissing('http://x.com')).to.equal('http://x.com')
    expect(addHttpsIfMissing('ipfs://cid')).to.equal('ipfs://cid')
    expect(addHttpsIfMissing('example.com')).to.equal('https://example.com')
    expect(removeMarkdownFormatting('# *bold* ~and~ `code`')).to.equal(' bold and code')
    expect(bytesOfString('é')).to.equal(2)
    expect(bufferToHex(Buffer.from('ab'))).to.equal('0x6162')
    expect(tokenSymbolText({ tokenSymbol: 'MOONEY', includeTokenWord: true })).to.equal(
      'MOONEY token'
    )
    expect(tokenSymbolText({ capitalize: true, plural: true })).to.equal('Tokens')
  })

  it('splits an announcement around matches and names a duration', () => {
    expect(parseAnnouncementText('see https://moondao.com today', /https?:\/\/\S+/g)).to.deep.equal(
      ['see ', 'https://moondao.com', ' today']
    )
    expect(getHumanTime(1000)).to.equal('1 second')
    expect(getHumanTime(2000)).to.equal('2 seconds')
    expect(getHumanTime(-90 * 60 * 1000)).to.equal('1 hour')
    expect(getHumanTime(60 * 1000)).to.equal('60 seconds')
  })

  it('builds a unix timestamp a whole number of days ahead', () => {
    const before = Math.floor(Date.now() / 1000)
    const stamp = daysFromNowTimestamp(2)
    const after = Math.floor(Date.now() / 1000)
    expect(stamp).to.be.at.least(before + 2 * 86400)
    expect(stamp).to.be.at.most(after + 2 * 86400)
    expect(secondsToMS(2)).to.equal(2000)
    expect(formatHistoricalDate(Math.floor(Date.now() / 1000))).to.match(/ago$/)
  })
})

describe('citizen locations', () => {
  it('reads every stored location shape and drops sentinel coordinates', () => {
    expect(parseLocationData(undefined)).to.deep.equal({ name: '', lat: null, lng: null })
    expect(parseLocationData('  ')).to.deep.equal({ name: '', lat: null, lng: null })
    expect(parseLocationData('Austin, Texas')).to.deep.equal({
      name: 'Austin, Texas',
      lat: null,
      lng: null,
    })
    expect(parseLocationData('"Austin, Texas"').name).to.equal('Austin, Texas')
    expect(parseLocationData('Antarctica')).to.deep.equal({ name: '', lat: null, lng: null })
    expect(parseLocationData('{"name":"Paris","lat":48.8,"lng":2.3}')).to.deep.equal({
      name: 'Paris',
      lat: 48.8,
      lng: 2.3,
    })
    expect(parseLocationData('{"name":"Nowhere","lat":0,"lng":0}')).to.deep.equal({
      name: 'Nowhere',
      lat: null,
      lng: null,
    })
    expect(parseLocationData('{')).to.deep.equal({ name: '', lat: null, lng: null })
  })

  it('groups pins that a geocoder moved by a few meters', () => {
    expect(locationGroupKey(38.90721, -77.03654)).to.equal(locationGroupKey(38.90719, -77.03651))
    expect(locationGroupKey(38.90721, -77.03654)).to.not.equal(locationGroupKey(40.7, -74))
  })
})

describe('invite tokens', () => {
  it('mints an unguessable url-safe token', () => {
    const token = generateInviteToken()
    expect(token).to.match(/^[A-Za-z0-9_-]{43}$/)
    expect(generateInviteToken()).to.not.equal(token)
  })
})

describe('contribute modal chain pick', () => {
  it('picks the largest balance and breaks ties toward Arbitrum', () => {
    expect(pickChainWithMaxNativeBalance([], [ethereum, arbitrum])).to.equal(ethereum)
    expect(
      pickChainWithMaxNativeBalance(
        [
          { chain: ethereum, wei: BigInt(5) },
          { chain: arbitrum, wei: BigInt(1) },
        ],
        [arbitrum]
      )
    ).to.equal(ethereum)
    expect(
      pickChainWithMaxNativeBalance(
        [
          { chain: ethereum, wei: BigInt(5) },
          { chain: arbitrum, wei: BigInt(5) },
          { chain: base, wei: BigInt(5) },
        ],
        [base, ethereum]
      )
    ).to.equal(arbitrum)
    expect(
      pickChainWithMaxNativeBalance(
        [
          { chain: base, wei: BigInt(2) },
          { chain: arbitrumSepolia, wei: BigInt(2) },
        ],
        [base]
      )
    ).to.equal(arbitrumSepolia)
    expect(
      pickChainWithMaxNativeBalance(
        [
          { chain: base, wei: BigInt(2) },
          { chain: ethereum, wei: BigInt(2) },
        ],
        [ethereum, base]
      )
    ).to.equal(ethereum)
  })
})

describe('lunar atlas sky stations', () => {
  it('places a station east and north from its bearing', () => {
    const east = stationOffsetM({ bearingDeg: 0, ringM: 100, altM: 0, wingBearingDeg: 0 })
    expect(east.eastM).to.be.closeTo(100, 1e-9)
    expect(east.northM).to.be.closeTo(0, 1e-9)
    const north = stationOffsetM({ bearingDeg: 90, ringM: 100, altM: 0, wingBearingDeg: 0 })
    expect(north.eastM).to.be.closeTo(0, 1e-9)
    expect(north.northM).to.be.closeTo(100, 1e-9)
  })
})

describe('cycle query params', () => {
  const fallback = { quarter: 2, year: 2026 }

  it('uses the fallback unless both numbers are in range', () => {
    expect(parseCycleParams({ query: {} } as any, fallback)).to.deep.equal({
      ok: true,
      params: fallback,
    })
    expect(
      parseCycleParams({ query: { quarter: ['4', '1'], year: '2027' } } as any, fallback)
    ).to.deep.equal({ ok: true, params: { quarter: 4, year: 2027 } })
    expect(parseCycleParams({ query: { quarter: '', year: '' } } as any, fallback).ok).to.equal(
      true
    )
    const badQuarter = parseCycleParams({ query: { quarter: 'foo' } } as any, fallback)
    expect(badQuarter.ok).to.equal(false)
    if (!badQuarter.ok) expect(badQuarter.error).to.include('quarter')
    const badYear = parseCycleParams({ query: { year: '2019' } } as any, fallback)
    expect(badYear.ok).to.equal(false)
    expect(parseCycleParams({ query: { quarter: '1.5' } } as any, fallback).ok).to.equal(false)
    expect(parseCycleParams({ query: { quarter: '0' } } as any, fallback).ok).to.equal(false)
  })
})
