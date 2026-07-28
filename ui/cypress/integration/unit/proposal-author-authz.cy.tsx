/**
 * Pin tests for the server-side proposal update/delete authorization gate.
 *
 * `/api/proposals/submit` (UPDATE branch) re-derives the proposal author from
 * the CURRENT on-chain `proposalIPFS` JSON and only lets that author edit or
 * withdraw (`deleted: true`) the proposal. Before this gate, the endpoint only
 * proved the session owned the caller-supplied `address` — it never checked
 * that `address` authored the proposal — so any authenticated user could
 * rewrite or delete ANY proposal by MDP, removing competitors from the
 * /projects listings and the Senate advance tally.
 *
 * These tests lock in the fail-closed behavior of the pure decision helper so a
 * future refactor can't silently reopen the hole.
 */
import { isProposalAuthor } from '../../../lib/proposals/isProposalAuthor'

describe('proposal author authorization', () => {
  const author = '0x08B3e694caA2F1fcF8eF71095CED1326f3454B89'

  it('allows the recorded author (case-insensitive)', () => {
    expect(isProposalAuthor(author, author)).to.equal(true)
    expect(isProposalAuthor(author.toLowerCase(), author.toUpperCase())).to.equal(
      true
    )
  })

  it('rejects a different authenticated caller', () => {
    const attacker = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef'
    expect(isProposalAuthor(author, attacker)).to.equal(false)
  })

  it('fails closed when the current author cannot be established', () => {
    // e.g. legacy proposal JSON without authorAddress, or an IPFS read failure.
    expect(isProposalAuthor(undefined, author)).to.equal(false)
    expect(isProposalAuthor(null, author)).to.equal(false)
    expect(isProposalAuthor('', author)).to.equal(false)
  })

  it('fails closed when the caller address is missing/malformed', () => {
    expect(isProposalAuthor(author, undefined)).to.equal(false)
    expect(isProposalAuthor(author, '')).to.equal(false)
    expect(isProposalAuthor(author, 123 as any)).to.equal(false)
  })
})
