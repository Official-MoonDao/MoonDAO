import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { resetAnalyticsState } from '../analytics/ga4'
import { castSenateTempCheckVote } from './castSenateTempCheckVote'

function installGtag() {
  const calls: unknown[][] = []
  const gtag = (...args: unknown[]) => {
    calls.push(args)
  }
  ;(global as { window?: unknown }).window = { gtag }
  return calls
}

describe('SenateVoteButtons proposal_vote', () => {
  afterEach(() => {
    resetAnalyticsState()
    delete (global as { window?: unknown }).window
  })

  it('fires proposal_vote after sendAndConfirmTransaction resolves', async () => {
    const calls = installGtag()
    let sent = false
    await castSenateTempCheckVote(
      {
        account: { address: `0x${'11'.repeat(20)}` },
        proposalContract: { address: '0xproposal' },
        mdp: 274,
        pass: true,
        surface: 'projects_list',
      },
      {
        prepareContractCall: (() => ({ id: 'tx' })) as never,
        sendAndConfirmTransaction: async () => {
          sent = true
          return { transactionHash: `0x${'ab'.repeat(32)}` }
        },
      }
    )
    assert.strictEqual(sent, true)
    assert.deepStrictEqual(calls, [
      [
        'event',
        'proposal_vote',
        { proposal_id: '274', vote_stage: 'senate', surface: 'projects_list' },
      ],
    ])
  })

  it('does not fire proposal_vote when sendAndConfirmTransaction rejects', async () => {
    const calls = installGtag()
    await assert.rejects(() =>
      castSenateTempCheckVote(
        {
          account: { address: `0x${'11'.repeat(20)}` },
          proposalContract: { address: '0xproposal' },
          mdp: 274,
          pass: false,
          surface: 'projects_list',
        },
        {
          prepareContractCall: (() => ({ id: 'tx' })) as never,
          sendAndConfirmTransaction: async () => {
            throw new Error('user rejected')
          },
        }
      )
    )
    assert.deepStrictEqual(calls, [])
  })

  it('is what SenateVoteButtons calls for a projects-list vote', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../../components/project/SenateVote.tsx'),
      'utf8'
    )
    const start = src.indexOf('export const SenateVoteButtons')
    const end = src.indexOf('SenateVoteButtons.displayName')
    const buttons = src.slice(start, end)
    assert.ok(start >= 0 && end > start)
    const voteAt = buttons.indexOf('castSenateTempCheckVote(')
    assert.ok(voteAt > buttons.indexOf('handleVote'))
    assert.match(buttons.slice(voteAt), /surface:\s*'projects_list'/)
    const page = src.slice(src.indexOf('export default function SenateVote'))
    assert.match(page, /surface:\s*'proposal_page'/)
  })
})
