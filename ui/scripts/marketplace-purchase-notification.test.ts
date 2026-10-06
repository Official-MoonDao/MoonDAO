import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  BUYER_RECEIPT_SUBJECT,
  OPS_FALLBACK_SUBJECT,
  VENDOR_MISSING_SUBJECT,
  deliverMarketplaceReceipts,
  isRetryablePurchaseStatus,
  parsePurchaseBody,
  postMarketplacePurchase,
  purchaseAlreadyRecorded,
  withTimeout,
} from '../lib/marketplace/purchaseNotification'

/**
 * Same gate as middleware/authMiddleware.ts: a Privy Bearer token or a
 * NextAuth session, otherwise 401 and the purchase handler never runs.
 */
function authMiddlewareOutcome(
  authorization: string | undefined,
  hasSession: boolean
): 'next' | 401 {
  if (authorization?.startsWith('Bearer ') && authorization.slice('Bearer '.length).trim()) {
    return 'next'
  }
  if (hasSession) return 'next'
  return 401
}

const buyerContent = { text: 'buyer', html: '<p>buyer</p>' }
const vendorContent = { text: 'vendor', html: '<p>vendor</p>' }

describe('marketplace purchase notifications', () => {
  it('parsePurchaseBody accepts a raw string and a parsed object', () => {
    const fields = { email: 'a@b.co', txHash: '0xabc', isGift: false }
    assert.deepEqual(parsePurchaseBody(JSON.stringify(fields)), fields)
    assert.deepEqual(parsePurchaseBody(fields), fields)
    assert.equal(parsePurchaseBody(''), null)
    assert.equal(parsePurchaseBody('not-json'), null)
    assert.equal(parsePurchaseBody(null), null)
    assert.equal(parsePurchaseBody([fields]), null)
  })

  it('authMiddleware 401s a purchase POST with no Bearer and no session', () => {
    // BuyTeamListingModal used to POST the receipt with the token only in the
    // body. authMiddleware never reads the body.
    assert.equal(authMiddlewareOutcome(undefined, false), 401)
    assert.equal(authMiddlewareOutcome(undefined, true), 'next')
    assert.equal(authMiddlewareOutcome('Bearer privy-token', false), 'next')
  })

  it('postMarketplacePurchase sends the Privy Bearer header', async () => {
    const calls: Array<{ headers: Record<string, string>; body: string }> = []
    const result = await postMarketplacePurchase({
      accessToken: 'privy-token',
      payload: { email: 'buyer@example.com', txHash: '0xabc' },
      backoffMs: 0,
      fetchImpl: async (_url, init) => {
        calls.push({ headers: init.headers, body: init.body })
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ success: true, giftLink: 'https://example.test/g' }),
        }
      },
    })
    assert.equal(calls.length, 1)
    assert.equal(calls[0].headers.Authorization, 'Bearer privy-token')
    assert.equal(calls[0].headers['Content-Type'], 'application/json')
    assert.equal(authMiddlewareOutcome(calls[0].headers.Authorization, false), 'next')
    const body = JSON.parse(calls[0].body)
    assert.equal(body.accessToken, 'privy-token')
    assert.equal(body.email, 'buyer@example.com')
    assert.equal(result.success, true)
    assert.equal(result.giftLink, 'https://example.test/g')
  })

  it('a dropped response after the server accepted the tx is success', async () => {
    const result = await postMarketplacePurchase({
      accessToken: 'privy-token',
      payload: { txHash: '0xabc' },
      backoffMs: 0,
      maxAttempts: 1,
      fetchImpl: async () => ({
        ok: false,
        status: 400,
        text: async () =>
          JSON.stringify({
            message: 'Transaction has already been processed for marketplace purchase',
          }),
      }),
    })
    assert.equal(purchaseAlreadyRecorded(400, result.message), true)
    assert.equal(result.success, true)
  })

  it('a gift replay without the invite link is not success', async () => {
    let attempts = 0
    const result = await postMarketplacePurchase({
      accessToken: 'privy-token',
      payload: { txHash: '0xabc', isGift: true },
      backoffMs: 0,
      maxAttempts: 3,
      fetchImpl: async () => {
        attempts += 1
        return {
          ok: false,
          status: 400,
          text: async () =>
            JSON.stringify({
              message: 'Transaction has already been processed for marketplace purchase',
            }),
        }
      },
    })
    assert.equal(attempts, 1)
    assert.equal(result.success, false)
    assert.equal(result.giftLink, undefined)
  })

  it('a gift replay that returns the same link is success', async () => {
    const result = await postMarketplacePurchase({
      accessToken: 'privy-token',
      payload: { txHash: '0xabc', isGift: true },
      backoffMs: 0,
      maxAttempts: 1,
      fetchImpl: async () => ({
        ok: false,
        status: 400,
        text: async () =>
          JSON.stringify({
            message: 'Transaction has already been processed for marketplace purchase',
            giftLink: 'https://example.test/citizen?invite=same',
          }),
      }),
    })
    assert.equal(result.success, true)
    assert.equal(result.giftLink, 'https://example.test/citizen?invite=same')
  })

  it('retries a 500 from the mailer and does not retry a 400', async () => {
    assert.equal(isRetryablePurchaseStatus(500), true)
    assert.equal(isRetryablePurchaseStatus(400), false)
    let attempts = 0
    const result = await postMarketplacePurchase({
      accessToken: 'privy-token',
      payload: { txHash: '0xabc' },
      backoffMs: 0,
      fetchImpl: async () => {
        attempts += 1
        if (attempts < 3) {
          return { ok: false, status: 500, text: async () => JSON.stringify({ message: 'smtp' }) }
        }
        return { ok: true, status: 200, text: async () => JSON.stringify({ success: true }) }
      },
    })
    assert.equal(attempts, 3)
    assert.equal(result.success, true)

    attempts = 0
    const rejected = await postMarketplacePurchase({
      accessToken: 'privy-token',
      payload: { txHash: '0xabc' },
      backoffMs: 0,
      fetchImpl: async () => {
        attempts += 1
        return {
          ok: false,
          status: 400,
          text: async () =>
            JSON.stringify({ message: "Transaction is not from the user's wallet" }),
        }
      },
    })
    assert.equal(attempts, 1)
    assert.equal(rejected.success, false)
  })

  it('the old lookup-then-send order misses the platform timeout', async () => {
    // Model of marketplace-purchase.ts before this fix: await vendor lookup,
    // then sendMail, on a route with no maxDuration (~10s platform default).
    async function lookupThenSend(budgetMs: number): Promise<boolean> {
      let sent = false
      await Promise.race([
        (async () => {
          await new Promise(() => {})
          sent = true
        })(),
        new Promise((resolve) => setTimeout(resolve, budgetMs)),
      ])
      return sent
    }
    assert.equal(await lookupThenSend(20), false)
    assert.equal(await withTimeout(new Promise(() => {}), 20), null)
  })

  it('buyer and ops are mailed even when vendor lookup never returns', async () => {
    const sent: Array<{ to: string; subject: string; bcc?: string[] }> = []
    const delivery = await deliverMarketplaceReceipts({
      buyerEmail: 'buyer@example.com',
      opsEmail: 'info@moondao.com',
      buyerContent,
      vendorContent,
      vendorLookupTimeoutMs: 30,
      lookupVendorEmail: () => new Promise(() => {}),
      sendMail: async (mail) => {
        sent.push(mail)
      },
    })
    assert.equal(delivery.buyerSent, true)
    assert.equal(delivery.opsNotified, true)
    assert.equal(delivery.vendorEmail, null)
    assert.equal(sent[0].to, 'buyer@example.com')
    assert.equal(sent[0].subject, BUYER_RECEIPT_SUBJECT)
    assert.deepEqual(sent[0].bcc, ['info@moondao.com'])
    assert.equal(sent[1].to, 'info@moondao.com')
    assert.equal(sent[1].subject, VENDOR_MISSING_SUBJECT)
  })

  it('a rejected buyer address still notifies the vendor and MoonDAO', async () => {
    const sent: Array<{ to: string; subject: string }> = []
    const delivery = await deliverMarketplaceReceipts({
      buyerEmail: 'not-an-email',
      opsEmail: 'info@moondao.com',
      buyerContent,
      vendorContent,
      lookupVendorEmail: async () => 'vendor@example.com',
      sendMail: async (mail) => {
        if (mail.to === 'not-an-email') throw new Error('invalid recipient')
        sent.push(mail)
      },
    })
    assert.equal(delivery.buyerSent, false)
    assert.equal(delivery.vendorSent, true)
    assert.equal(delivery.opsNotified, true)
    assert.deepEqual(
      sent.map((mail) => mail.to),
      ['vendor@example.com', 'info@moondao.com']
    )
    assert.equal(sent[1].subject, OPS_FALLBACK_SUBJECT)
  })

  it('the buy modal posts receipts through the bearer helper', () => {
    const modal = fs.readFileSync(
      path.join(__dirname, '../components/subscription/BuyTeamListingModal.tsx'),
      'utf8'
    )
    assert.equal(modal.includes('postMarketplacePurchase'), true)
    assert.equal(modal.includes("'/api/marketplace/marketplace-purchase'"), false)
    const api = fs.readFileSync(
      path.join(__dirname, '../pages/api/marketplace/marketplace-purchase.ts'),
      'utf8'
    )
    assert.equal(api.includes('deliverMarketplaceReceipts'), true)
    assert.equal(api.includes('maxDuration: 60'), true)
    assert.equal(api.includes('issueMarketplaceGiftInvite'), true)
    assert.equal(api.includes('readyMarketplaceGiftToken'), true)
  })

})
