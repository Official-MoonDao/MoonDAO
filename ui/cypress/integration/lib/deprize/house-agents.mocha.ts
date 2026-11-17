import { ethers } from 'ethers'
import {
  HOUSE_AGENT_REQUEST_MAX_AGE_MS,
  houseAgentPermitMessage,
  isHouseAgentWallet,
  verifyHouseAgentRequest,
} from '@/lib/deprize/houseAgents'

const agent = new ethers.Wallet(`0x${'22'.repeat(32)}`)
const stranger = new ethers.Wallet(`0x${'33'.repeat(32)}`)
const NOW = 1_800_000_000_000

async function signedBody(signer: ethers.Wallet, overrides: Record<string, unknown> = {}) {
  const request = { wallet: agent.address, deprizeId: 1, chainId: 42161, issuedAt: NOW, ...overrides }
  const signature = await signer.signMessage(houseAgentPermitMessage(request as any))
  return { ...request, signature }
}

describe('house agent permit requests', () => {
  const prev = process.env.DEPRIZE_HOUSE_AGENT_WALLETS

  beforeEach(() => {
    process.env.DEPRIZE_HOUSE_AGENT_WALLETS = ` ${agent.address}, not-an-address `
  })

  afterEach(() => {
    if (prev === undefined) delete process.env.DEPRIZE_HOUSE_AGENT_WALLETS
    else process.env.DEPRIZE_HOUSE_AGENT_WALLETS = prev
  })

  it('reads only valid addresses from the allowlist', () => {
    expect(isHouseAgentWallet(agent.address)).to.equal(true)
    expect(isHouseAgentWallet(agent.address.toLowerCase())).to.equal(true)
    expect(isHouseAgentWallet(stranger.address)).to.equal(false)
    delete process.env.DEPRIZE_HOUSE_AGENT_WALLETS
    expect(isHouseAgentWallet(agent.address)).to.equal(false)
  })

  it('accepts a fresh request signed by a listed wallet', async () => {
    const check = verifyHouseAgentRequest(await signedBody(agent), NOW + 1000)
    expect(check.ok).to.equal(true)
    if (check.ok) expect(check.request.wallet).to.equal(agent.address.toLowerCase())
  })

  it('refuses a wallet that is not on the allowlist', async () => {
    const body = await signedBody(stranger, { wallet: stranger.address })
    const check = verifyHouseAgentRequest(body, NOW)
    expect(check).to.deep.equal({ ok: false, status: 403, error: 'Not a house agent wallet' })
  })

  it('refuses a request signed by another key', async () => {
    const check = verifyHouseAgentRequest(await signedBody(stranger), NOW)
    expect(check).to.deep.equal({ ok: false, status: 401, error: 'Signature does not match wallet' })
  })

  it('refuses a request whose fields differ from what was signed', async () => {
    const body = await signedBody(agent)
    const check = verifyHouseAgentRequest({ ...body, deprizeId: 2 }, NOW)
    expect(check).to.deep.equal({ ok: false, status: 401, error: 'Signature does not match wallet' })
  })

  it('refuses stale and future-dated requests', async () => {
    const body = await signedBody(agent)
    expect(verifyHouseAgentRequest(body, NOW + HOUSE_AGENT_REQUEST_MAX_AGE_MS + 1)).to.deep.equal({
      ok: false,
      status: 401,
      error: 'Request expired',
    })
    expect(verifyHouseAgentRequest(body, NOW - 60_000)).to.deep.equal({ ok: false, status: 401, error: 'Request expired' })
  })

  it('refuses malformed input', () => {
    expect(verifyHouseAgentRequest(null, NOW)).to.deep.equal({ ok: false, status: 400, error: 'Invalid wallet' })
    expect(verifyHouseAgentRequest({ wallet: agent.address, deprizeId: 1, chainId: 42161, issuedAt: NOW, signature: '0x12' }, NOW)).to.deep.equal({
      ok: false,
      status: 400,
      error: 'Invalid signature',
    })
  })
})
