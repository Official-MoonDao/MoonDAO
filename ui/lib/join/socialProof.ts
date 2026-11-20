/**
 * Social proof shared by /join and /citizenship: featured Citizens and Teams,
 * testimonial photos, and the expiry filter that keeps lapsed members out.
 * Server-side only (getStaticProps).
 */
import {
  CITIZEN_ADDRESSES,
  CITIZEN_TABLE_NAMES,
  TEAM_ADDRESSES,
  TEAM_TABLE_NAMES,
} from 'const/config'
import { TESTIMONIAL_CITIZEN_IDS, testimonials as testimonialsContent } from 'const/joinPageContent'
import type { TestimonialWithPhoto } from 'const/joinPageContent'
import { FEATURED_CITIZEN_ROLES, FEATURED_CITIZENS, FEATURED_TEAMS } from 'const/whitelist'
import { getContract, NFT, readContract } from 'thirdweb'
import { citizenRowToNFT, teamRowToNFT } from '@/lib/tableland/convertRow'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/serverClient'

// Validate NFT expirations server-side via Multicall3: one eth_call per ~200
// NFTs instead of one RPC request per NFT, which the RPC provider rate-limits.
// (The previous implementation used Array.filter(async ...) which returns
// truthy promises — it filtered nothing while still firing one RPC per NFT.)
const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11'

export async function filterUnexpiredNFTs(
  nfts: NFT[],
  targetAddress: string,
  chain: any,
  now: number
) {
  if (!nfts.length) return []

  const { ethers } = await import('ethers')
  const iface = new ethers.utils.Interface([
    'function expiresAt(uint256 tokenId) view returns (uint256)',
  ])
  const multicall = getContract({
    client: serverClient,
    address: MULTICALL3_ADDRESS,
    chain,
  })

  const valid: NFT[] = []
  const CHUNK_SIZE = 200
  for (let i = 0; i < nfts.length; i += CHUNK_SIZE) {
    // Token id 0 is mapped to '' by the row converters (`id || ''`), so
    // resolve from the raw top-level id and skip anything non-numeric.
    const batch = nfts
      .slice(i, i + CHUNK_SIZE)
      .map((nft: any) => {
        const tokenId = Number(nft?.id ?? nft?.metadata?.id)
        if (!Number.isFinite(tokenId)) return null
        return { nft, callData: iface.encodeFunctionData('expiresAt', [tokenId]) }
      })
      .filter(Boolean) as { nft: NFT; callData: string }[]

    if (!batch.length) continue

    try {
      const results: any = await readContract({
        contract: multicall,
        method:
          'function aggregate3((address target, bool allowFailure, bytes callData)[] calls) payable returns ((bool success, bytes returnData)[] returnData)',
        params: [
          batch.map(({ callData }) => ({
            target: targetAddress,
            allowFailure: true,
            callData: callData as `0x${string}`,
          })),
        ],
      })

      results.forEach((res: any, idx: number) => {
        if (!res.success) return
        const [expiresAt] = iface.decodeFunctionResult('expiresAt', res.returnData)
        if (+expiresAt.toString() > now) {
          valid.push(batch[idx].nft)
        }
      })
    } catch (error) {
      console.error('Error validating NFT expirations:', error)
      // Fail open for this chunk so a transient RPC error doesn't blank the
      // directory; expired entries will be filtered on the next revalidation.
      valid.push(...batch.map(({ nft }) => nft))
    }
  }
  return valid
}

// Strips a citizen NFT down to what the /join featured-citizens marquee
// renders, and attaches the marketing tagline from FEATURED_CITIZEN_ROLES
// (not on-chain data, so it's maintained in const/whitelist.ts).
export function toFeaturedCitizen(nft: any) {
  const id = nft.id ?? nft.metadata?.id ?? ''
  return {
    id,
    name: nft.metadata?.name ?? '',
    image: nft.metadata?.image ?? '',
    role: FEATURED_CITIZEN_ROLES[Number(id)] ?? '',
  }
}

// Strips a team NFT down to what the /join featured-teams marquee renders.
export function toFeaturedTeam(nft: any) {
  return {
    id: nft.id ?? nft.metadata?.id ?? '',
    name: nft.metadata?.name ?? '',
    image: nft.metadata?.image ?? '',
  }
}

// Loosely normalize a name for matching testimonial authors against on-chain
// citizen records — strips quoted nicknames (e.g. "Andrew 'Titan' Parris")
// and collapses whitespace so first-name-only testimonials still match.
function normalizeName(name: string) {
  return name
    .toLowerCase()
    .replace(/["'][^"']*["']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Best-effort match of a testimonial author to their citizen profile photo.
// Checks the explicit TESTIMONIAL_CITIZEN_IDS override first (for cases where
// the on-chain display name doesn't resemble the testimonial name), then
// falls back to a fuzzy name match. Falls back to no image (component renders
// an initials avatar) when neither finds a match — logged so it's visible in
// build output.
export function matchCitizenPhotoByName(name: string, citizens: any[]): string | null {
  const overrideId = TESTIMONIAL_CITIZEN_IDS[name]
  if (overrideId !== undefined) {
    const overrideMatch = citizens.find(
      (nft: any) => Number(nft.id ?? nft.metadata?.id) === overrideId
    )
    if (overrideMatch) return overrideMatch.metadata?.image || null
  }

  const needle = normalizeName(name)
  const matches = citizens.filter((nft: any) => {
    const rowName = normalizeName(nft.metadata?.name ?? '')
    return rowName && (rowName.includes(needle) || needle.includes(rowName))
  })
  if (!matches.length) {
    console.warn(
      `[join] No citizen match found for testimonial name "${name}" — using fallback avatar.`
    )
    return null
  }
  if (matches.length > 1) {
    console.warn(
      `[join] Multiple citizen matches for testimonial name "${name}" — using the first match.`
    )
  }
  // getStaticProps props must be JSON-serializable — undefined isn't allowed,
  // so an unset image on the citizen record falls back to null, not undefined.
  return matches[0].metadata?.image || null
}

export type JoinSocialProof = {
  featuredCitizens: ReturnType<typeof toFeaturedCitizen>[]
  featuredTeams: ReturnType<typeof toFeaturedTeam>[]
  testimonials: TestimonialWithPhoto[]
}

/**
 * Loads the featured Citizens and Teams (only unexpired members) and matches
 * testimonial photos. Never throws: on any failure it returns the testimonials
 * without photos and empty featured lists, which the marquees hide.
 */
export async function loadJoinSocialProof(chain: any): Promise<JoinSocialProof> {
  const chainSlug = getChainSlug(chain)
  const now = Math.floor(Date.now() / 1000)
  try {
    const citizenTable = CITIZEN_TABLE_NAMES[chainSlug]
    const teamTable = TEAM_TABLE_NAMES[chainSlug]
    const [citizenRows, teamRows]: any[] = await Promise.all([
      citizenTable ? queryTable(chain, `SELECT * FROM ${citizenTable}`) : [],
      teamTable && FEATURED_TEAMS.length
        ? queryTable(
            chain,
            `SELECT * FROM ${teamTable} WHERE id IN (${FEATURED_TEAMS.map(Number).join(',')})`
          )
        : [],
    ])

    const citizens: NFT[] = (citizenRows || []).map((row: any) => citizenRowToNFT(row))
    const teams: NFT[] = (teamRows || []).map((row: any) => teamRowToNFT(row))
    const [validCitizens, validTeams]: any[] = await Promise.all([
      filterUnexpiredNFTs(citizens, CITIZEN_ADDRESSES[chainSlug], chain, now),
      filterUnexpiredNFTs(teams, TEAM_ADDRESSES[chainSlug], chain, now),
    ])

    const byId = (list: any[], id: number) =>
      list.find((nft: any) => Number(nft.id ?? nft.metadata?.id) === Number(id))

    return {
      featuredCitizens: FEATURED_CITIZENS.map((id: number) => byId(validCitizens, id))
        .filter(Boolean)
        .map(toFeaturedCitizen),
      featuredTeams: FEATURED_TEAMS.map((id: number) => byId(validTeams, id))
        .filter(Boolean)
        .map(toFeaturedTeam),
      testimonials: testimonialsContent.map((testimonial) => ({
        ...testimonial,
        image: matchCitizenPhotoByName(testimonial.name, validCitizens),
      })),
    }
  } catch (error) {
    console.error('Error loading join social proof:', error)
    return {
      featuredCitizens: [],
      featuredTeams: [],
      testimonials: testimonialsContent.map((t) => ({ ...t, image: null })),
    }
  }
}
