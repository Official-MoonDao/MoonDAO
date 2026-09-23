import CitizenABI from 'const/abis/Citizen.json'
import WhitelistABI from 'const/abis/Whitelist.json'
import {
  BENDYSTRAW_JB_VERSION,
  DEFAULT_CHAIN_V5,
  CITIZEN_ADDRESSES,
  CITIZEN_DISCOUNTLIST_ADDRESSES,
  CITIZEN_WHITELIST_ADDRESSES,
  FREE_MINT_THRESHOLD,
  MISSION_TABLE_NAMES,
} from 'const/config'
import { setCDNCacheHeaders } from 'middleware/cacheHeaders'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import { readContract, prepareContractCall, sendAndConfirmTransaction, getContract } from 'thirdweb'
import { ethers5Adapter } from 'thirdweb/adapters/ethers5'
import { cacheExchange, createClient, fetchExchange } from 'urql'
import {
  buildInviteQuote,
  dueWei,
  isFullDiscount,
  isPaymentTxHash,
  resolveDiscountBps,
  shouldAddInviteToDiscountList,
  validateDiscountPayment,
  type DiscountBps,
} from '@/lib/citizen/discountInvite'
import {
  CitizenInvite,
  claimDiscountPayment,
  consumeInvite,
  peekInvite,
  releaseDiscountPaymentLock,
  restoreInvite,
  setDiscountPaymentStatus,
} from '@/lib/citizen/inviteTokens'
import { enforceRegionNotRestricted } from '@/lib/geo'
import { createHSMWallet, getHSMAddress, sendEthFromHSM } from '@/lib/google/hsm-signer'
import { addressBelongsToPrivyUser } from '@/lib/privy'
import { L2_GAS_BUDGET_WEI } from '@/lib/rpc/gasBudget'
import { escapeSingleQuotes } from '@/lib/tableland/cleanData'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/serverClient'

// Configuration constants
const chain = DEFAULT_CHAIN_V5
const chainSlug = getChainSlug(chain)
const privateKey = process.env.XP_ORACLE_SIGNER_PK

// Use the Bendystraw (Juicebox) subgraph which tracks participants and pay events
const bendystrawUrl = `https://${
  process.env.NEXT_PUBLIC_CHAIN !== 'mainnet' ? 'testnet.' : ''
}bendystraw.xyz/${process.env.BENDYSTRAW_API_KEY}/graphql`

const subgraphClient = createClient({
  url: bendystrawUrl,
  exchanges: [fetchExchange, cacheExchange],
})

function isValidEvmAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr)
}

// Pull the Privy access token from the Authorization header or request body.
function getAccessTokenFromReq(req: NextApiRequest): string | null {
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim()
  }
  const bodyToken = req.body?.accessToken
  return typeof bodyToken === 'string' && bodyToken.length > 0 ? bodyToken : null
}

// Cache MoonDAO mission projectIds (refreshes every 5 minutes)
let cachedProjectIds: number[] = []
let projectIdsCacheTime = 0
const PROJECT_IDS_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async function getMoonDAOProjectIds(): Promise<number[]> {
  const now = Date.now()
  if (cachedProjectIds.length > 0 && now - projectIdsCacheTime < PROJECT_IDS_CACHE_TTL) {
    return cachedProjectIds
  }

  try {
    const tableName = MISSION_TABLE_NAMES[chainSlug]
    if (!tableName) {
      console.error('No MissionTable name for chain:', chainSlug)
      return cachedProjectIds
    }
    const rows = await queryTable(chain, `SELECT projectId FROM ${tableName}`)
    const ids = (rows || [])
      .map((r: any) => Number(r.projectId))
      .filter((id: number) => id > 0 && !isNaN(id))
    if (ids.length > 0) {
      cachedProjectIds = ids
      projectIdsCacheTime = now
    }
    return cachedProjectIds
  } catch (err) {
    console.error('Error fetching MoonDAO project IDs:', err)
    return cachedProjectIds // return stale cache on error
  }
}

async function getTotalPaid(address: string) {
  if (!isValidEvmAddress(address)) {
    throw new Error('Invalid EVM address')
  }

  const moonDAOProjectIds = await getMoonDAOProjectIds()
  if (moonDAOProjectIds.length === 0) return BigInt(0)

  // Query payEvents by beneficiary instead of participants by address.
  // Bendystraw keys Participant.volume by the payer (msg.sender of pay()),
  // which for cross-chain contributions is the CrossChainPay contract, not
  // the user. PayEvent.beneficiary correctly reflects the actual contributor.
  const query = `
    query ($addr: String!, $projectIds: [Int!]!, $version: Int!) {
      payEvents(
        limit: 1000,
        where: {
          beneficiary: $addr,
          projectId_in: $projectIds,
          version: $version
        }
      ) {
        items {
          amount
        }
      }
    }
  `
  const subgraphRes = await subgraphClient
    .query(query, {
      addr: address.toLowerCase(),
      projectIds: moonDAOProjectIds,
      version: Number(BENDYSTRAW_JB_VERSION),
    })
    .toPromise()
  if (subgraphRes.error) {
    console.error('Bendystraw query error:', subgraphRes.error)
    throw new Error(subgraphRes.error.message)
  }
  const events = subgraphRes.data?.payEvents?.items || []

  const totalPaid = events.reduce((acc: bigint, e: any) => {
    return acc + BigInt(e.amount || '0')
  }, BigInt(0))
  return totalPaid
}

// The Citizen contract has two separate allowlists (both `Whitelist` contracts):
//   - whitelist:    gates who may call mintTo (the msg.sender), unless openAccess
//   - discountList: zeroes getRenewalPrice() for the recipient (discount == 1000)
// We sponsor a free mint for addresses on either list. Being on the *discount*
// list is what makes the mint truly gas-only (renewal price 0); an address that
// is only on the mint whitelist still mints free, but the relayer also covers
// the renewal fee (which is paid to moonDAOTreasury).
// Returns true if listed, false if confirmed not listed, null if the RPC failed.
async function isOnCitizenList(
  address: string,
  listAddress: string | undefined
): Promise<boolean | null> {
  if (!listAddress) return false
  try {
    const listContract = getContract({
      client: serverClient,
      address: listAddress,
      abi: WhitelistABI as any,
      chain,
    })
    const listed = await readContract({
      contract: listContract,
      method: 'isWhitelisted' as string,
      params: [address],
    })
    return Boolean(listed)
  } catch (err) {
    console.error('Error checking citizen allowlist:', err)
    return null
  }
}

// True when the address is on either the mint whitelist or the (price-zeroing)
// discount list. Returns null only when a list check failed and the address was
// not confirmed on the other list, so callers can fall back to the contribution
// check rather than wrongly rejecting an eligible user.
async function isCitizenFreeMintListed(address: string): Promise<boolean | null> {
  if (!isValidEvmAddress(address)) return false
  const [whitelisted, discounted] = await Promise.all([
    isOnCitizenList(address, CITIZEN_WHITELIST_ADDRESSES[chainSlug]),
    isOnCitizenList(address, CITIZEN_DISCOUNTLIST_ADDRESSES[chainSlug]),
  ])
  if (whitelisted === true || discounted === true) return true
  if (whitelisted === null || discounted === null) return null
  return false
}

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60

type LoadedPayment = {
  from: string | null
  to: string | null
  valueWei: bigint
  status: number | null
}

async function readRenewalPrice(address: string): Promise<bigint> {
  const citizenContract = getContract({
    client: serverClient,
    address: CITIZEN_ADDRESSES[chainSlug],
    abi: CitizenABI as any,
    chain,
  })
  const cost: any = await readContract({
    contract: citizenContract,
    method: 'getRenewalPrice' as string,
    params: [address, ONE_YEAR_SECONDS],
  })
  return BigInt(cost)
}

async function loadDiscountPayment(txHash: string): Promise<LoadedPayment | null> {
  const provider = ethers5Adapter.provider.toEthers({
    client: serverClient,
    chain,
  })
  const [tx, receipt] = await Promise.all([
    provider.getTransaction(txHash),
    provider.getTransactionReceipt(txHash),
  ])
  if (!tx) return null
  return {
    from: tx.from ?? null,
    to: tx.to ?? null,
    valueWei: BigInt(tx.value.toString()),
    status: receipt?.status == null ? null : Number(receipt.status),
  }
}

type PartialSettlement =
  | {
      ok: true
      invite: CitizenInvite
      payment: { txHash: string; valueWei: bigint } | null
    }
  | { ok: false; status: number; body: Record<string, unknown> }

/**
 * Bind a partial-discount invite to a confirmed payment, then consume it.
 * The payment lock stays held on success so the mint can finish before another
 * request touches the same tx. Callers release the lock when they are done.
 */
async function settlePartialDiscountPayment(params: {
  inviteToken: string
  invite: CitizenInvite
  discountBps: DiscountBps
  address: string
  paymentTxHash: unknown
}): Promise<PartialSettlement> {
  const { inviteToken, invite, discountBps, address } = params
  let fullPrice: bigint
  try {
    fullPrice = await readRenewalPrice(address)
  } catch (err) {
    console.error('[freeMint] getRenewalPrice failed:', err)
    return {
      ok: false,
      status: 503,
      body: { error: 'Unable to price this invite right now. Please try again in a moment.' },
    }
  }
  const due = dueWei(fullPrice, discountBps)
  const fullPriceWei = fullPrice.toString()
  const dueWeiString = due.toString()

  if (due === BigInt(0)) {
    const consumed = await consumeInvite(inviteToken, address)
    if (!consumed) {
      return {
        ok: false,
        status: 400,
        body: { error: 'This invite link is invalid or has already been used.' },
      }
    }
    return { ok: true, invite, payment: null }
  }

  const paymentTxHash = typeof params.paymentTxHash === 'string' ? params.paymentTxHash.trim() : ''
  if (!isPaymentTxHash(paymentTxHash)) {
    return {
      ok: false,
      status: 400,
      body: {
        error: 'Send the discounted citizenship price before minting.',
        dueWei: dueWeiString,
        fullPriceWei,
      },
    }
  }

  let payTo: string
  try {
    payTo = await getHSMAddress()
  } catch (err) {
    console.error('[freeMint] HSM address unavailable:', err)
    return {
      ok: false,
      status: 503,
      body: { error: 'Discount payments are unavailable right now. Please try again in a moment.' },
    }
  }

  let loaded: LoadedPayment | null
  try {
    loaded = await loadDiscountPayment(paymentTxHash)
  } catch (err) {
    console.error('[freeMint] payment lookup failed:', err)
    return {
      ok: false,
      status: 503,
      body: { error: 'Unable to verify the payment right now. Please try again in a moment.' },
    }
  }
  if (!loaded) {
    return {
      ok: false,
      status: 400,
      body: {
        error:
          'Payment transaction was not found on the citizenship network. Wait for it to confirm and try again.',
      },
    }
  }

  const check = validateDiscountPayment({
    from: loaded.from,
    to: loaded.to,
    valueWei: loaded.valueWei,
    status: loaded.status,
    payer: address,
    payTo,
    dueWei: due,
  })
  if (!check.ok && check.code !== 'underpaid') {
    return { ok: false, status: 400, body: { error: check.message } }
  }

  const claim = await claimDiscountPayment({
    txHash: paymentTxHash,
    payer: address,
    token: inviteToken,
    valueWei: loaded.valueWei.toString(),
  })
  if (claim === 'unavailable') {
    return {
      ok: false,
      status: 503,
      body: { error: 'Invite storage is unavailable. Please try again in a moment.' },
    }
  }
  if (claim === 'locked') {
    return {
      ok: false,
      status: 409,
      body: { error: 'This payment is already being processed. Try again in a moment.' },
    }
  }
  if (claim === 'spent') {
    return { ok: false, status: 400, body: { error: 'This payment was already used.' } }
  }
  if (claim === 'refunded') {
    return {
      ok: false,
      status: 400,
      body: {
        error: 'This payment was refunded. Send a new payment to continue.',
        dueWei: dueWeiString,
        fullPriceWei,
        // Same signal as a fresh refund. Without it, a refresh reloads the dead
        // hash from session and retries it forever.
        refunded: true,
      },
    }
  }
  if (claim === 'mismatch') {
    return {
      ok: false,
      status: 400,
      body: { error: 'This payment is tied to a different wallet.' },
    }
  }

  const refundClaimed = async (
    status: number,
    body: Record<string, unknown>
  ): Promise<PartialSettlement> => {
    try {
      await sendEthFromHSM(address, loaded.valueWei)
      await setDiscountPaymentStatus(paymentTxHash, 'refunded')
    } catch (err) {
      console.error('[freeMint] discount refund failed:', err)
      await releaseDiscountPaymentLock(paymentTxHash)
      return {
        ok: false,
        status: 500,
        body: { error: 'Could not refund the payment. Try again in a moment.' },
      }
    }
    await releaseDiscountPaymentLock(paymentTxHash)
    return { ok: false, status, body }
  }

  if (!check.ok) {
    return refundClaimed(409, {
      error:
        'The citizenship price changed and the payment was short, so it was refunded. Please pay the updated amount.',
      dueWei: dueWeiString,
      fullPriceWei,
      refunded: true,
    })
  }

  const consumed = await consumeInvite(inviteToken, address, {
    paidWei: loaded.valueWei.toString(),
    paymentTx: paymentTxHash,
  })
  if (!consumed) {
    return refundClaimed(400, {
      error: 'This invite link is invalid or has already been used.',
      refunded: true,
    })
  }

  return {
    ok: true,
    invite,
    payment: { txHash: paymentTxHash, valueWei: loaded.valueWei },
  }
}

/**
 * Someone who already qualifies for a free mint should not also pay. When they
 * attached a real payment, send it back. Failures are logged and do not block
 * the sponsored mint.
 */
async function refundStrayDiscountPayment(
  address: string,
  inviteToken: string,
  paymentTxHash: unknown
): Promise<void> {
  if (typeof paymentTxHash !== 'string' || !isPaymentTxHash(paymentTxHash)) return
  try {
    const payTo = await getHSMAddress()
    const loaded = await loadDiscountPayment(paymentTxHash)
    if (!loaded || loaded.valueWei <= BigInt(0)) return
    const check = validateDiscountPayment({
      from: loaded.from,
      to: loaded.to,
      valueWei: loaded.valueWei,
      status: loaded.status,
      payer: address,
      payTo,
      dueWei: BigInt(0),
    })
    if (!check.ok) return
    const claim = await claimDiscountPayment({
      txHash: paymentTxHash,
      payer: address,
      token: inviteToken,
      valueWei: loaded.valueWei.toString(),
    })
    if (claim !== 'claimed') return
    try {
      await sendEthFromHSM(address, loaded.valueWei)
      await setDiscountPaymentStatus(paymentTxHash, 'refunded')
    } finally {
      await releaseDiscountPaymentLock(paymentTxHash)
    }
  } catch (err) {
    console.error('[freeMint] stray discount refund failed:', err)
  }
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    // GDPR: a sponsored citizen mint permanently writes the submitter's name
    // and profile image on chain, so block restricted regions server-side even
    // if the client gate was bypassed.
    if (!enforceRegionNotRestricted(req, res)) return

    const { address, name, image, formId, inviteToken } = req.body
    if (!address || !name || !image || !formId) {
      return res.status(400).json({ error: 'Mint params not found!' })
    }
    // Optional profile metadata collected at checkout. Coerce to strings so a
    // malformed body can never inject a non-string into the contract call, and
    // default to '' when absent (preserves the legacy blank-profile behavior).
    const asString = (v: unknown) => (typeof v === 'string' ? v : '')
    const bio = asString(req.body.bio)
    const location = asString(req.body.location)
    const discord = asString(req.body.discord)
    const twitter = asString(req.body.twitter)
    const website = asString(req.body.website)
    // Constrain visibility to the allowed enum; never trust the raw client value.
    const privacy = req.body.privacy === 'private' ? 'private' : 'public'
    if (!isValidEvmAddress(address)) {
      return res.status(400).json({ error: 'Invalid wallet address format.' })
    }
    const citizenContract = getContract({
      client: serverClient,
      address: CITIZEN_ADDRESSES[chainSlug],
      abi: CitizenABI as any,
      chain: chain,
    })
    const balance: any = await readContract({
      contract: citizenContract,
      method: 'balanceOf' as string,
      params: [address],
    })
    if (balance !== BigInt(0)) {
      return res.status(400).json({ error: 'You are already a citizen!' })
    }

    // Check existing eligibility first (allowlist or contribution threshold)
    // before consuming any invite token. This prevents burning a one-time invite
    // when the user is already eligible through other means.
    const listed = await isCitizenFreeMintListed(address)
    const alreadyEligible = listed === true
    let totalPaid = BigInt(0)
    if (!alreadyEligible) {
      // Wrap getTotalPaid so subgraph failures don't block invite redemption.
      // Users with valid invite tokens should be able to mint even during a
      // subgraph outage, since invites don't depend on contribution history.
      try {
        totalPaid = await getTotalPaid(address)
      } catch (err) {
        console.error('getTotalPaid failed (non-blocking for invite flow):', err)
        // totalPaid stays 0; if user has an invite token it will still work
      }
      if (totalPaid >= BigInt(FREE_MINT_THRESHOLD)) {
        // User meets contribution threshold; no invite needed.
        // (Don't set alreadyEligible in the `listed === null` branch since
        // that signals an RPC error, and we should still accept a valid invite.)
      }
    }

    // Magic-link path: a one-time invite token sponsors the mint, but only
    // consume it if the user is NOT already eligible. We require the caller to
    // prove (via Privy auth) that they own `address`, then atomically consume
    // the token so it can never be reused. `consumedInvite` is kept so we can
    // restore the token if the mint later fails.
    //
    // Partial discounts (20% / 50%) additionally require a confirmed payment of
    // the recipient's share before the token is consumed. 100% and legacy
    // invites stay on the fully sponsored path.
    let consumedInvite: CitizenInvite | null = null
    let partialDiscount = false
    let discountPayment: { txHash: string; valueWei: bigint } | null = null
    if (inviteToken) {
      if (alreadyEligible || totalPaid >= BigInt(FREE_MINT_THRESHOLD)) {
        // User is already eligible; ignore the invite token (don't consume it)
        // so they can share it with someone who needs it. Return a partial
        // payment if they sent one anyway.
        await refundStrayDiscountPayment(address, inviteToken, req.body.paymentTxHash)
      } else {
        const accessToken = getAccessTokenFromReq(req)
        if (!accessToken || !(await addressBelongsToPrivyUser(accessToken, address))) {
          return res
            .status(401)
            .json({ error: 'You must be signed in with this wallet to redeem an invite.' })
        }
        let invite: CitizenInvite | null = null
        let peekFailed = false
        try {
          invite = await peekInvite(inviteToken)
        } catch (err) {
          peekFailed = true
          console.error('peekInvite failed:', err)
        }
        const discountBps = invite ? resolveDiscountBps(invite.discountBps) : null
        if (invite && !discountBps) {
          return res
            .status(400)
            .json({ error: 'This invite link is invalid or has already been used.' })
        }
        if (peekFailed && !invite) {
          return res.status(503).json({
            error: 'Unable to verify invite at this time. Please try again in a moment.',
          })
        }
        if (invite && discountBps && !isFullDiscount(discountBps)) {
          const settled = await settlePartialDiscountPayment({
            inviteToken,
            invite,
            discountBps,
            address,
            paymentTxHash: req.body.paymentTxHash,
          })
          if (!settled.ok) {
            return res.status(settled.status).json(settled.body)
          }
          partialDiscount = true
          consumedInvite = settled.invite
          discountPayment = settled.payment
        } else {
          // Fully sponsored, or a peek that missed while the key still exists.
          // consumeInvite returns the stored record, so a partial invite that
          // peek missed is restored instead of being minted for free.
          const consumed = await consumeInvite(inviteToken, address)
          if (!consumed) {
            return res
              .status(400)
              .json({ error: 'This invite link is invalid or has already been used.' })
          }
          const consumedBps = resolveDiscountBps(consumed.discountBps)
          if (!consumedBps || !isFullDiscount(consumedBps)) {
            await restoreInvite(inviteToken, consumed)
            return res.status(400).json({
              error:
                consumedBps && !isFullDiscount(consumedBps)
                  ? 'Send the discounted citizenship price before minting.'
                  : 'This invite link is invalid or has already been used.',
            })
          }
          consumedInvite = consumed
        }
      }
    } else {
      // No invite token: user must be eligible via allowlist or contribution.
      if (!alreadyEligible && totalPaid < BigInt(FREE_MINT_THRESHOLD)) {
        return res.status(400).json({
          error: 'You have not contributed enough to earn a free citizen NFT!',
        })
      }
    }

    // Track whether the mint transaction succeeded so we only restore the invite
    // on actual mint failures, not on subsequent response serialization errors.
    let mintSucceeded = false
    try {
      const account = await createHSMWallet()

      // For invite-token redeemers, attempt to add the recipient to the
      // DiscountList so that getRenewalPrice() returns 0 and the HSM wallet
      // only covers gas — not the renewal fee — when calling mintTo.
      // PREREQUISITE: the DiscountList contract's owner must be the HSM wallet
      // (0xb206325E6562517532686dFeeEaD4C104D9F5d32). Until that one-time Safe
      // transaction is done (transferOwnership on 0x755D48e6C3744B723bd0326C57F99A92a3Ca3287),
      // this step will fail silently and the HSM will continue paying the
      // renewal fee as before — no regression in behavior.
      if (
        shouldAddInviteToDiscountList({
          partialDiscount,
          consumedInvite: Boolean(consumedInvite),
        }) &&
        CITIZEN_DISCOUNTLIST_ADDRESSES[chainSlug]
      ) {
        try {
          const discountListContract = getContract({
            client: serverClient,
            address: CITIZEN_DISCOUNTLIST_ADDRESSES[chainSlug],
            abi: WhitelistABI as any,
            chain,
          })
          const addToDiscountListTx = prepareContractCall({
            contract: discountListContract,
            method: 'addToWhitelist' as string,
            params: [address],
          })
          await sendAndConfirmTransaction({ transaction: addToDiscountListTx, account })
          console.log(`[freeMint] Added ${address} to DiscountList — mint will be gas-only`)
        } catch (discountErr: any) {
          console.warn(
            `[freeMint] Could not add ${address} to DiscountList (HSM may not own it yet): ${
              discountErr?.message ?? discountErr
            }. ` +
              `Transfer DiscountList ownership (0x755D48e6C3744B723bd0326C57F99A92a3Ca3287) to HSM ` +
              `(0xb206325E6562517532686dFeeEaD4C104D9F5d32) to eliminate renewal-fee payments.`
          )
        }
      }

      const cost: any = await readContract({
        contract: citizenContract,
        method: 'getRenewalPrice' as string,
        params: [address, 365 * 24 * 60 * 60],
      })
      const transaction = prepareContractCall({
        contract: citizenContract,
        method: 'mintTo' as string,
        // Escape single quotes on every free-text field. The Citizen contract
        // builds the Tableland INSERT with SQLHelpers.quote(), which does NOT
        // escape embedded quotes, so an apostrophe (e.g. a bio with "Brazil's")
        // yields malformed SQL the validator rejects — the NFT mints but the
        // metadata row is never created. `location` already arrives escaped from
        // the client (buildCitizenProfileMintFields) and `privacy` is a fixed
        // enum, so neither is re-escaped here.
        params: [
          address,
          escapeSingleQuotes(name),
          escapeSingleQuotes(bio),
          image,
          location,
          escapeSingleQuotes(discord),
          escapeSingleQuotes(twitter),
          escapeSingleQuotes(website),
          privacy,
          escapeSingleQuotes(formId),
        ],
        value: cost,
      })
      const receipt = await sendAndConfirmTransaction({
        transaction,
        account,
      })
      mintSucceeded = true

      if (discountPayment) {
        try {
          await setDiscountPaymentStatus(discountPayment.txHash, 'spent')
        } catch (err) {
          console.error('[freeMint] failed to mark discount payment spent:', err)
        }
      }

      // Fully sponsored mints include a gas stipend so a new wallet can
      // transact. Partial-discount recipients already paid from this wallet.
      if (!partialDiscount) {
        // Send enough ETH to cover a conservative wallet gas lock
        // (`gasLimit * maxFeePerGas`), not just the expected L2 execution cost.
        // 0.00002 ETH was below observed Arbitrum locks (~0.00012 ETH).
        sendEthFromHSM(address, L2_GAS_BUDGET_WEI).catch((err) =>
          console.error('Gas stipend transfer failed (non-critical):', err)
        )
      }

      const jsonReceipt = JSON.stringify(receipt, (key, value) => {
        if (typeof value === 'bigint') {
          return value.toString()
        }
        return value
      })
      res.status(200).json(JSON.parse(jsonReceipt))
    } catch (err) {
      // Only restore the invite if the mint transaction itself failed. If the
      // transaction succeeded but response serialization/sending failed, the
      // citizen already exists and we must not restore the one-time token.
      if (!mintSucceeded && !partialDiscount && inviteToken && consumedInvite) {
        await restoreInvite(inviteToken, consumedInvite)
      }
      let paymentRefunded = false
      if (!mintSucceeded && partialDiscount && discountPayment && consumedInvite && inviteToken) {
        let mintedAnyway = false
        try {
          const balanceAfter: any = await readContract({
            contract: citizenContract,
            method: 'balanceOf' as string,
            params: [address],
          })
          mintedAnyway = balanceAfter !== BigInt(0)
        } catch (balanceErr) {
          // Can't tell whether the mint landed. Leave the invite consumed and
          // the payment unrefunded so we don't pay twice or revive a used link.
          mintedAnyway = true
          console.error('[freeMint] balance check after mint error failed:', balanceErr)
        }
        if (!mintedAnyway) {
          await restoreInvite(inviteToken, consumedInvite)
          try {
            await sendEthFromHSM(address, discountPayment.valueWei)
            await setDiscountPaymentStatus(discountPayment.txHash, 'refunded')
            paymentRefunded = true
          } catch (refundErr) {
            console.error('[freeMint] refund after failed mint failed:', refundErr)
          }
        } else {
          try {
            await setDiscountPaymentStatus(discountPayment.txHash, 'spent')
          } catch (statusErr) {
            console.error(
              '[freeMint] failed to mark payment spent after uncertain mint:',
              statusErr
            )
          }
        }
      }
      console.error('Free mint failed:', err)
      return res.status(500).json({
        error: paymentRefunded
          ? 'Mint failed and your payment was refunded. Please try again.'
          : 'Mint failed. Please try again.',
        refunded: paymentRefunded,
      })
    } finally {
      if (discountPayment) {
        await releaseDiscountPaymentLock(discountPayment.txHash)
      }
    }
  }
  if (req.method === 'GET') {
    const address = req.query.address
    // Accept invite token from header only (not query string) to prevent leakage
    // via browser history, analytics, proxies, and Referer headers.
    let inviteToken = req.headers['x-invite-token']

    // Normalize header to string (Next.js can provide string | string[])
    if (Array.isArray(inviteToken)) {
      inviteToken = inviteToken[0]
    }

    if (!address || typeof address !== 'string') {
      return res.status(400).json({ error: 'Address is required.' })
    }
    if (!isValidEvmAddress(address)) {
      return res.status(400).json({ error: 'Invalid wallet address format.' })
    }

    // A valid (unconsumed) invite token makes the user eligible for a sponsored
    // mint, but only if they don't already hold a citizen NFT. We only peek
    // here — the token is consumed at mint time (POST).
    if (inviteToken) {
      let invite: CitizenInvite | null
      try {
        invite = await peekInvite(inviteToken)
      } catch (err) {
        // Redis error or other infrastructure failure. Return 503 so the client
        // knows this is a transient failure, not a definitive "invite is invalid."
        console.error('peekInvite failed:', err)
        return res.status(503).json({
          error: 'Unable to verify invite at this time. Please try again in a moment.',
        })
      }
      if (invite === null) {
        // Invite not found, expired, or already consumed. Return 400 so the
        // client clears the sponsored state instead of misleading the user.
        return res.status(400).json({
          error: 'This invite link is invalid, expired, or has already been used.',
        })
      }
      const discountBps = resolveDiscountBps(invite.discountBps)
      if (!discountBps) {
        return res.status(400).json({
          error: 'This invite link is invalid, expired, or has already been used.',
        })
      }
      // Invite-based eligibility responses should not be cached since they
      // depend on the one-time token header, not just the address.
      res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate')
      const citizenContract = getContract({
        client: serverClient,
        address: CITIZEN_ADDRESSES[chainSlug],
        abi: CitizenABI as any,
        chain: chain,
      })
      const balance: any = await readContract({
        contract: citizenContract,
        method: 'balanceOf' as string,
        params: [address as string],
      })
      if (balance !== BigInt(0)) {
        return res.status(400).json({ error: 'You are already a citizen!' })
      }

      // Fully sponsored links stay on the original eligibility payload so a
      // free invite does not wait on a price quote or the sponsor address.
      if (isFullDiscount(discountBps)) {
        return res.status(200).json({
          success: true,
          message: 'Invite is valid.',
          data: {
            totalPaid: '0',
            whitelisted: false,
            invited: true,
            eligible: true,
            sponsored: true,
            discountBps,
          },
        })
      }

      const listed = await isCitizenFreeMintListed(address as string)
      let totalPaid = BigInt(0)
      if (listed !== true) {
        try {
          totalPaid = await getTotalPaid(address as string)
        } catch (err) {
          console.error('getTotalPaid failed during invite quote:', err)
        }
      }
      const alreadyFreeEligible = listed === true || totalPaid >= BigInt(FREE_MINT_THRESHOLD)

      if (alreadyFreeEligible || isFullDiscount(discountBps)) {
        const quote = buildInviteQuote({
          discountBps,
          alreadyFreeEligible: true,
          fullPriceWei: BigInt(0),
          payTo: '',
        })
        return res.status(200).json({
          success: true,
          message: 'Invite is valid.',
          data: {
            totalPaid: totalPaid.toString(),
            whitelisted: listed === true,
            invited: true,
            eligible: true,
            sponsored: quote.sponsored,
            discountBps: quote.discountBps,
          },
        })
      }

      let fullPrice: bigint
      try {
        fullPrice = await readRenewalPrice(address as string)
      } catch (err) {
        console.error('[freeMint] getRenewalPrice failed:', err)
        return res.status(503).json({
          error: 'Unable to price this invite right now. Please try again in a moment.',
        })
      }
      let payTo: string
      try {
        payTo = await getHSMAddress()
      } catch (err) {
        console.error('[freeMint] HSM address unavailable:', err)
        return res.status(503).json({
          error: 'Discount payments are unavailable right now. Please try again in a moment.',
        })
      }
      const quote = buildInviteQuote({
        discountBps,
        alreadyFreeEligible: false,
        fullPriceWei: fullPrice,
        payTo,
      })
      if (quote.sponsored) {
        return res.status(200).json({
          success: true,
          message: 'Invite is valid.',
          data: {
            totalPaid: totalPaid.toString(),
            whitelisted: false,
            invited: true,
            eligible: true,
            sponsored: true,
            discountBps: quote.discountBps,
          },
        })
      }
      return res.status(200).json({
        success: true,
        message: 'Invite is valid.',
        data: {
          totalPaid: totalPaid.toString(),
          whitelisted: false,
          invited: true,
          eligible: true,
          sponsored: false,
          discountBps: quote.discountBps,
          fullPriceWei: quote.fullPriceWei,
          dueWei: quote.dueWei,
          payTo: quote.payTo,
        },
      })
    }

    // Standard eligibility check (allowlist or contribution threshold) can be cached
    setCDNCacheHeaders(res, 60, 60, 'Accept-Encoding')
    const listed = await isCitizenFreeMintListed(address as string)
    let totalPaid = BigInt(0)
    if (listed === true) {
      // For listed users, try to get totalPaid but don't fail if subgraph is down
      try {
        totalPaid = await getTotalPaid(address as string)
      } catch (err) {
        console.error('Could not fetch totalPaid for listed user:', err)
        // totalPaid stays 0, but user is still eligible due to the allowlist
      }
    } else if (listed === false) {
      totalPaid = await getTotalPaid(address as string)
    } else {
      // listed === null (RPC error): fall back to contribution check only
      try {
        totalPaid = await getTotalPaid(address as string)
      } catch (err) {
        console.error('Both allowlist and subgraph checks failed:', err)
        return res.status(503).json({ error: 'Unable to verify eligibility. Please try again.' })
      }
    }
    res.status(200).json({
      success: true,
      message: 'Fetched total paid.',
      data: {
        totalPaid: totalPaid.toString(),
        whitelisted: listed === true,
        invited: false,
        sponsored: false,
        eligible: listed === true || totalPaid >= BigInt(FREE_MINT_THRESHOLD),
      },
    })
  }
}
export default withMiddleware(handler, rateLimit)
