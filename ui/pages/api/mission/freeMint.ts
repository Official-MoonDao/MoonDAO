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
import { cacheExchange, createClient, fetchExchange } from 'urql'
import { CitizenInvite, consumeInvite, peekInvite, restoreInvite } from '@/lib/citizen/inviteTokens'
import { enforceRegionNotRestricted } from '@/lib/geo'
import { createHSMWallet, sendEthFromHSM } from '@/lib/google/hsm-signer'
import { addressBelongsToPrivyUser } from '@/lib/privy'
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
  listAddress: string | undefined,
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
    let consumedInvite: CitizenInvite | null = null
    if (inviteToken) {
      if (alreadyEligible || totalPaid >= BigInt(FREE_MINT_THRESHOLD)) {
        // User is already eligible; ignore the invite token (don't consume it)
        // so they can share it with someone who needs it.
      } else {
        const accessToken = getAccessTokenFromReq(req)
        if (!accessToken || !(await addressBelongsToPrivyUser(accessToken, address))) {
          return res
            .status(401)
            .json({ error: 'You must be signed in with this wallet to redeem an invite.' })
        }
        // Peek to get invite metadata for potential restore, but always attempt
        // consume even if peek fails (peek failures might be transient Redis
        // errors while the key still exists). consumeInvite is atomic and will
        // return false if the invite doesn't exist, is expired, or was already used.
        const invite = await peekInvite(inviteToken)
        const consumed = await consumeInvite(inviteToken, address)
        if (!consumed) {
          return res
            .status(400)
            .json({ error: 'This invite link is invalid or has already been used.' })
        }
        // Use peeked metadata if available; fall back to minimal record if peek
        // failed but consume succeeded (transient Redis error during peek).
        consumedInvite = invite || { createdAt: Date.now() }
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
      const cost: any = await readContract({
        contract: citizenContract,
        method: 'getRenewalPrice' as string,
        params: [address, 365 * 24 * 60 * 60],
      })
      const account = await createHSMWallet()
      const transaction = prepareContractCall({
        contract: citizenContract,
        method: 'mintTo' as string,
        params: [
          address,
          name,
          bio,
          image,
          location,
          discord,
          twitter,
          website,
          privacy,
          formId,
        ],
        value: cost,
      })
      const receipt = await sendAndConfirmTransaction({
        transaction,
        account,
      })
      mintSucceeded = true

      // Send a small gas stipend (~$0.05 worth of ETH) so new citizens can
      // interact on-chain right away without needing to fund their wallet first.
      // 0.00002 ETH ≈ $0.06 at $3 000/ETH on Arbitrum.
      const GAS_STIPEND_WEI = BigInt('20000000000000') // 0.00002 ETH
      sendEthFromHSM(address, GAS_STIPEND_WEI).catch((err) =>
        console.error('Gas stipend transfer failed (non-critical):', err)
      )

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
      if (!mintSucceeded && inviteToken && consumedInvite) {
        await restoreInvite(inviteToken, consumedInvite)
      }
      console.error('Free mint failed:', err)
      return res.status(500).json({ error: 'Mint failed. Please try again.' })
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
      return res.status(200).json({
        success: true,
        message: 'Invite is valid.',
        data: { totalPaid: '0', whitelisted: false, invited: true, eligible: true },
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
        eligible: listed === true || totalPaid >= BigInt(FREE_MINT_THRESHOLD),
      },
    })
  }
}
export default withMiddleware(handler, rateLimit)
