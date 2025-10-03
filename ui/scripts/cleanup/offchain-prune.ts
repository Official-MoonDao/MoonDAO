import JBV5ControllerABI from 'const/abis/JBV5Controller.json'
import MarketplaceTableABI from 'const/abis/MarketplaceTable.json'
import {
  CITIZEN_TABLE_NAMES,
  TEAM_TABLE_NAMES,
  MISSION_TABLE_NAMES,
  PROJECT_TABLE_NAMES,
  MARKETPLACE_TABLE_ADDRESSES,
  JBV5_CONTROLLER_ADDRESS,
  MOONDAO_HAT_TREE_IDS,
  PROJECT_HAT_TREE_IDS,
  IPFS_GATEWAY,
} from 'const/config'
import dotenv from 'dotenv'
import { GraphQLClient, gql } from 'graphql-request'
import {
  createThirdwebClient,
  defineChain,
  getContract,
  readContract,
} from 'thirdweb'
import { cacheExchange, createClient, fetchExchange } from 'urql'
import { Contribution } from '@/lib/coordinape/types'
import { NANCE_SPACE_NAME, NANCE_API_URL } from '@/lib/nance/constants'
import queryTable from '@/lib/tableland/queryTable'

dotenv.config({ path: '.env.local' })

// Note: We don't need the Nance SDK - direct API calls work better

const infuraKey = process.env.NEXT_PUBLIC_INFURA_KEY
const etherscanApiKey = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY
const coordinapeApiKey = process.env.COORDINAPE_API_KEY

// Coordinape GraphQL client setup
const coordinapeEndpoint = 'https://coordinape-prod.hasura.app/v1/graphql'
const coordinapeClient = coordinapeApiKey
  ? new GraphQLClient(coordinapeEndpoint, {
      headers: {
        Authorization: `Bearer ${coordinapeApiKey}`,
      },
    })
  : undefined

export const arbitrum = defineChain({
  id: 42161,
  name: 'Arbitrum One',
  rpc: `https://arbitrum-mainnet.infura.io/v3/${infuraKey}`,
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  blockExplorers: [
    {
      name: 'Arbiscan',
      url: 'https://arbiscan.io',
      apiUrl: `https://api.etherscan.io/v2/api?apikey=${etherscanApiKey}&chainid=42161`,
    },
  ],
})

export const sepolia = defineChain({
  id: 11155111,
  name: 'Sepolia',
  rpc: `https://sepolia.infura.io/v3/${infuraKey}`,
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  blockExplorers: [
    {
      name: 'Etherscan',
      url: 'https://sepolia.etherscan.io',
      apiUrl: `https://api.etherscan.io/v2/api?apikey=${etherscanApiKey}&chainid=11155111`,
    },
  ],
  testnet: true,
})

const websiteMetadataIPFSHashes = new Set<string>([
  'bafybeifkfe5t6ihnqxwr4uksiiphj2obshr5baslkl4v36yo2jxbxigazu',
  'QmdTYGGb5ayHor23WeCsNeT61Qzj8JK9EQmxKWeuGTQhYq',
])

const FORM_IDS = [
  process.env.NEXT_PUBLIC_TYPEFORM_TEAM_FORM_ID as string,
  process.env.NEXT_PUBLIC_TYPEFORM_TEAM_EMAIL_FORM_ID as string,
  process.env.NEXT_PUBLIC_TYPEFORM_CITIZEN_FORM_ID as string,
  process.env.NEXT_PUBLIC_TYPEFORM_CITIZEN_SHORT_FORM_ID as string,
  process.env.NEXT_PUBLIC_TYPEFORM_CITIZEN_EMAIL_FORM_ID as string,
]

// Initialize thirdweb client for server-side usage
const thirdwebClient = createThirdwebClient({
  secretKey: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_SECRET as string,
})

// Initialize JuiceBox controller contract
const jbControllerContractArbitrum = getContract({
  client: thirdwebClient,
  chain: arbitrum,
  address: JBV5_CONTROLLER_ADDRESS,
  abi: JBV5ControllerABI.abi as any,
})

const jbControllerContractSepolia = getContract({
  client: thirdwebClient,
  chain: sepolia,
  address: JBV5_CONTROLLER_ADDRESS,
  abi: JBV5ControllerABI.abi as any,
})

// Initialize Marketplace table contracts
const marketplaceTableContractArbitrum = getContract({
  client: thirdwebClient,
  chain: arbitrum,
  address: MARKETPLACE_TABLE_ADDRESSES['arbitrum'],
  abi: MarketplaceTableABI as any,
})

const marketplaceTableContractSepolia = getContract({
  client: thirdwebClient,
  chain: sepolia,
  address: MARKETPLACE_TABLE_ADDRESSES['sepolia'],
  abi: MarketplaceTableABI as any,
})

function isValidIPFSHash(hash: string): boolean {
  return (
    hash.match(/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/) !== null ||
    hash.match(/^baf[a-z0-9]{56}$/) !== null
  )
}

async function upinFromPinata(ipfsHash: string) {
  try {
    const res = await fetch(
      `https://api.pinata.cloud/pinning/unpin/${ipfsHash}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${process.env.PINATA_JWT_KEY}`,
        },
      }
    )
    const data = await res.json()
    return data
  } catch (error) {
    console.error('Error unpinning from Pinata:', error)
    return null
  }
}

async function listAllPinnedCIDs() {
  const cids = []
  let pageOffset = 0
  while (true) {
    try {
      const url = `https://api.pinata.cloud/data/pinList?status=pinned&includeCount=true&pageLimit=${50}&pageOffset=${pageOffset}`
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${process.env.PINATA_JWT_KEY}`,
        },
      })
      const data = await res.json()
      for (const row of data.rows || []) cids.push(row.ipfs_pin_hash)
      const got = (data.rows || []).length
      if (got < 50) break
      pageOffset += got
      // small pause to be polite
      await new Promise((resolve) => setTimeout(resolve, 150))
    } catch (error) {
      console.error('Error listing all pinned CIDs:', error)
      return null
    }
  }
  return [...new Set(cids)]
}

async function deleteResponseFromTypeform(formId: string, responseId: string) {
  try {
    const res = await fetch(
      `https://api.typeform.com/forms/${formId}/responses?included_response_ids=${responseId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${process.env.TYPEFORM_PERSONAL_ACCESS_TOKEN}`,
        },
      }
    )
    const data = await res.json()
    return data
  } catch (error) {
    console.error('Error deleting response from Typeform:', error)
    return null
  }
}

async function getAllResponsesFromTypeform(formId: string) {
  try {
    const allResponses = []
    let pageToken = null
    let pageSize = 1000 // Maximum allowed by Typeform API

    do {
      const url = new URL(`https://api.typeform.com/forms/${formId}/responses`)
      url.searchParams.append('page_size', pageSize.toString())
      if (pageToken) {
        url.searchParams.append('before', pageToken)
      }

      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${process.env.TYPEFORM_PERSONAL_ACCESS_TOKEN}`,
        },
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }

      const data = await res.json()

      if (data.items && data.items.length > 0) {
        allResponses.push(...data.items)
        pageToken = data.items[data.items.length - 1].token
      } else {
        break
      }

      await new Promise((resolve) => setTimeout(resolve, 100))
    } while (pageToken)

    return {
      items: allResponses,
      total_items: allResponses.length,
    }
  } catch (error) {
    console.error(`Error getting all responses from Typeform ${formId}:`, error)
    return null
  }
}

async function fetchJuiceBoxProjectMetadata(
  projectId: string | number,
  jbControllerContract: any
): Promise<any> {
  try {
    // Convert string to number if needed and validate
    const numericProjectId =
      typeof projectId === 'string' ? parseInt(projectId, 10) : projectId

    // Validate that we have a valid number
    if (isNaN(numericProjectId) || numericProjectId <= 0) {
      console.warn(`Invalid project ID: ${projectId}`)
      return null
    }

    // Get metadata URI from JuiceBox controller
    const metadataURI: any = await readContract({
      contract: jbControllerContract,
      method: 'uriOf' as string,
      params: [numericProjectId], // Use the numeric version
    })

    if (!metadataURI) {
      console.warn(`No metadata URI found for project ${projectId}`)
      return null
    }

    // Handle IPFS URIs - support both ipfs:// prefixed and raw IPFS hashes
    let url = metadataURI
    if (metadataURI.startsWith('ipfs://')) {
      url = `${IPFS_GATEWAY}${metadataURI.replace('ipfs://', '')}`
    } else if (isValidIPFSHash(metadataURI)) {
      // Raw IPFS hash (either v0 starting with Qm or v1 starting with baf)
      url = `${IPFS_GATEWAY}${metadataURI}`
    }

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const metadata = await response.json()
    return { metadata, metadataURI }
  } catch (error) {
    console.error(
      `Error fetching JuiceBox project metadata for project ${projectId}:`,
      error
    )
    return null
  }
}

function extractIPFSHashesFromHat(
  hat: any,
  usedIPFSHashes: Set<string>,
  chainName: string
) {
  if (!hat) return

  // Extract IPFS hashes from imageUri
  if (hat.imageUri && typeof hat.imageUri === 'string') {
    const ipfsMatches = hat.imageUri.match(
      /Qm[1-9A-HJ-NP-Za-km-z]{44}|baf[a-z0-9]{56}/g
    )
    if (ipfsMatches) {
      ipfsMatches.forEach((hash: string) => {
        usedIPFSHashes.add(hash)
      })
    }
    // Also check for ipfs:// URIs
    if (hat.imageUri.startsWith('ipfs://')) {
      const hash = hat.imageUri.replace('ipfs://', '')
      usedIPFSHashes.add(hash)
    }
  }

  // Extract IPFS hashes from details
  if (hat.details && typeof hat.details === 'string') {
    const ipfsMatches = hat.details.match(
      /Qm[1-9A-HJ-NP-Za-km-z]{44}|baf[a-z0-9]{56}/g
    )
    if (ipfsMatches) {
      ipfsMatches.forEach((hash: string) => {
        usedIPFSHashes.add(hash)
      })
    }
    // Also check for ipfs:// URIs
    if (hat.details.startsWith('ipfs://')) {
      const hash = hat.details.replace('ipfs://', '')
      usedIPFSHashes.add(hash)
    }
  }

  // Recursively process subHats
  if (hat.subHats && Array.isArray(hat.subHats)) {
    hat.subHats.forEach((subHat: any) => {
      extractIPFSHashesFromHat(subHat, usedIPFSHashes, chainName)
    })
  }
}

async function fetchAllHatMetadataCIDs() {
  // Function to fetch all hats from a tree with direct GraphQL queries
  async function fetchAllHatsFromTree(chainId: number, treeId: string) {
    const allHats: any[] = []
    let lastId =
      '0x0000000000000000000000000000000000000000000000000000000000000000'
    const batchSize = 100
    let hasMore = true

    // Get the subgraph endpoint for this chain
    const subgraphUrl =
      chainId === arbitrum.id
        ? `https://gateway-arbitrum.network.thegraph.com/api/${process.env.THE_GRAPH_API_KEY}/subgraphs/id/4CiXQPjzKshBbyK2dgJiknTNWcj8cGUJsopTsXfm5HEk`
        : `https://api.studio.thegraph.com/query/55784/hats-v1-sepolia/version/latest`

    const subgraphClient = createClient({
      url: subgraphUrl,
      exchanges: [fetchExchange, cacheExchange],
    })

    while (hasMore) {
      try {
        const query = `
          query GetTreeHats($treeId: String!, $first: Int!, $lastId: String!) {
            tree(id: $treeId) {
              hats(
                first: $first, 
                where: { id_gt: $lastId }, 
                orderBy: id, 
                orderDirection: asc
              ) {
                id
                imageUri
                details
                subHats {
                  id
                  imageUri
                  details
                  subHats {
                    id
                    imageUri
                    details
                    subHats {
                      id
                      imageUri
                      details
                      subHats {
                        id
                        imageUri
                        details
                      }
                    }
                  }
                }
              }
            }
          }
        `

        const result = await subgraphClient
          .query(query, {
            treeId: treeId.toString(),
            first: batchSize,
            lastId: lastId,
          })
          .toPromise()

        if (result.error) {
          console.error('GraphQL errors:', result.error)
          break
        }

        const hats = result.data?.tree?.hats || []

        if (hats.length > 0) {
          allHats.push(...hats)
          lastId = hats[hats.length - 1].id
          // If we got less than the batch size, we've reached the end
          if (hats.length < batchSize) {
            hasMore = false
          }
        } else {
          hasMore = false
        }
      } catch (error) {
        console.error(`Error fetching hats for tree ${treeId}:`, error)
        hasMore = false
      }
    }
    return { hats: allHats }
  }

  // Fetch all hat trees with pagination
  const [
    moonDAOArbitrumHats,
    moonDAOSepoliaHats,
    projectArbitrumHats,
    projectSepoliaHats,
  ] = await Promise.all([
    fetchAllHatsFromTree(arbitrum.id, MOONDAO_HAT_TREE_IDS['arbitrum']),
    fetchAllHatsFromTree(sepolia.id, MOONDAO_HAT_TREE_IDS['sepolia']),
    fetchAllHatsFromTree(arbitrum.id, PROJECT_HAT_TREE_IDS['arbitrum']),
    fetchAllHatsFromTree(sepolia.id, PROJECT_HAT_TREE_IDS['sepolia']),
  ])

  // Log the number of hats fetched from each tree
  console.log('Hat counts:')
  console.log('- MoonDAO Arbitrum:', moonDAOArbitrumHats.hats?.length || 0)
  console.log('- MoonDAO Sepolia:', moonDAOSepoliaHats.hats?.length || 0)
  console.log('- Project Arbitrum:', projectArbitrumHats.hats?.length || 0)
  console.log('- Project Sepolia:', projectSepoliaHats.hats?.length || 0)

  const usedIPFSHashes = new Set<string>()

  // Process MoonDAO Arbitrum hats
  if (moonDAOArbitrumHats.hats) {
    moonDAOArbitrumHats.hats.forEach((hat: any) => {
      extractIPFSHashesFromHat(hat, usedIPFSHashes, 'MoonDAO Arbitrum')
    })
  }

  // Process MoonDAO Sepolia hats
  if (moonDAOSepoliaHats.hats) {
    moonDAOSepoliaHats.hats.forEach((hat: any) => {
      extractIPFSHashesFromHat(hat, usedIPFSHashes, 'MoonDAO Sepolia')
    })
  }

  // Process Project Arbitrum hats
  if (projectArbitrumHats.hats) {
    projectArbitrumHats.hats.forEach((hat: any) => {
      extractIPFSHashesFromHat(hat, usedIPFSHashes, 'Project Arbitrum')
    })
  }

  // Process Project Sepolia hats
  if (projectSepoliaHats.hats) {
    projectSepoliaHats.hats.forEach((hat: any) => {
      extractIPFSHashesFromHat(hat, usedIPFSHashes, 'Project Sepolia')
    })
  }

  console.log(`Found ${usedIPFSHashes.size} unique IPFS hashes from hats`)
  return usedIPFSHashes
}

async function getMarketplaceTableName(chain: 'arbitrum' | 'sepolia') {
  try {
    const contract =
      chain === 'arbitrum'
        ? marketplaceTableContractArbitrum
        : marketplaceTableContractSepolia

    const tableName = await readContract({
      contract,
      method: 'getTableName',
    })

    return tableName
  } catch (error) {
    console.error(`Error getting marketplace table name for ${chain}:`, error)
    return null
  }
}

// Function to fetch all proposals from Nance API
async function fetchAllNanceProposals() {
  const url = `${NANCE_API_URL}/${NANCE_SPACE_NAME}/proposals?cycle=All&limit=1000`

  try {
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(
        `Failed to fetch proposals: ${response.status} ${response.statusText}`
      )
    }

    const data = await response.json()

    // Check if the API returned an error
    if (data.success === false) {
      throw new Error(`API error: ${data.error || 'Unknown error'}`)
    }

    const proposals = data?.data?.proposals || []
    console.log(`Nance proposals: ${proposals.length}`)

    return proposals
  } catch (error) {
    console.error('❌ Error fetching Nance proposals:', error)
    return []
  }
}

// Function to extract IPFS hashes from proposal body text
function extractIPFSHashesFromProposalBody(
  proposalBody: string,
  proposalId: string,
  usedIPFSHashes: Set<string>
): string[] {
  if (!proposalBody || typeof proposalBody !== 'string') return []

  const hashes: string[] = []

  // Extract raw IPFS hashes (both v0 and v1)
  const ipfsMatches = proposalBody.match(
    /Qm[1-9A-HJ-NP-Za-km-z]{44}|baf[a-z0-9]{56}/g
  )
  if (ipfsMatches) {
    hashes.push(...ipfsMatches)
  }

  // Extract from ipfs:// URIs
  const ipfsUriMatches = proposalBody.match(
    /ipfs:\/\/([Qm][1-9A-HJ-NP-Za-km-z]{44}|baf[a-z0-9]{56})/g
  )
  if (ipfsUriMatches) {
    ipfsUriMatches.forEach((uri) => {
      const hash = uri.replace('ipfs://', '')
      hashes.push(hash)
    })
  }

  // Extract from IPFS gateway URLs
  const gatewayMatches = proposalBody.match(
    /https?:\/\/[^\/]*ipfs[^\/]*\/(?:ipfs\/)?([Qm][1-9A-HJ-NP-Za-km-z]{44}|baf[a-z0-9]{56})/g
  )
  if (gatewayMatches) {
    gatewayMatches.forEach((url) => {
      const match = url.match(/([Qm][1-9A-HJ-NP-Za-km-z]{44}|baf[a-z0-9]{56})/)
      if (match) {
        hashes.push(match[1])
      }
    })
  }

  // Extract from markdown image syntax ![alt](ipfs://hash) or ![alt](https://gateway/ipfs/hash)
  const markdownImageMatches = proposalBody.match(
    /!\[.*?\]\((?:ipfs:\/\/|https?:\/\/[^\/]*ipfs[^\/]*\/(?:ipfs\/)?)([Qm][1-9A-HJ-NP-Za-km-z]{44}|baf[a-z0-9]{56})[^\)]*\)/g
  )
  if (markdownImageMatches) {
    markdownImageMatches.forEach((match) => {
      const hashMatch = match.match(
        /([Qm][1-9A-HJ-NP-Za-km-z]{44}|baf[a-z0-9]{56})/
      )
      if (hashMatch) {
        hashes.push(hashMatch[1])
      }
    })
  }

  // Log and add unique hashes
  const uniqueHashes = [...new Set(hashes)]
  uniqueHashes.forEach((hash) => {
    usedIPFSHashes.add(hash)
  })

  return uniqueHashes
}

// Function to process all Nance proposals and extract IPFS hashes
async function fetchAllNanceProposalIPFSHashes() {
  const proposals = await fetchAllNanceProposals()
  const proposalIPFSHashes = new Set<string>()

  let totalHashesFound = 0

  for (const proposal of proposals) {
    const proposalId = proposal.proposalId || proposal.uuid || 'unknown'

    // Check proposal body
    if (proposal.body) {
      const hashes = extractIPFSHashesFromProposalBody(
        proposal.body,
        proposalId,
        proposalIPFSHashes
      )
      totalHashesFound += hashes.length
    }

    // Check proposal title
    if (proposal.title) {
      const titleHashes = extractIPFSHashesFromProposalBody(
        proposal.title,
        `${proposalId}-title`,
        proposalIPFSHashes
      )
      totalHashesFound += titleHashes.length
    }

    // Check ipfsURL field (specific to Nance proposals)
    if (proposal.ipfsURL) {
      const ipfsUrlHashes = extractIPFSHashesFromProposalBody(
        proposal.ipfsURL,
        `${proposalId}-ipfsURL`,
        proposalIPFSHashes
      )
      totalHashesFound += ipfsUrlHashes.length
    }

    // Check discussionThreadURL if it contains IPFS
    if (proposal.discussionThreadURL) {
      const discussionHashes = extractIPFSHashesFromProposalBody(
        proposal.discussionThreadURL,
        `${proposalId}-discussionURL`,
        proposalIPFSHashes
      )
      totalHashesFound += discussionHashes.length
    }
  }

  return Array.from(proposalIPFSHashes)
}

// Function to extract IPFS hashes from Coordinape contribution descriptions
function extractIPFSHashesFromContribution(
  contribution: Contribution,
  usedIPFSHashes: Set<string>
): string[] {
  if (!contribution.description || typeof contribution.description !== 'string')
    return []

  const hashes: string[] = []

  // Extract raw IPFS hashes (both v0 and v1)
  const ipfsMatches = contribution.description.match(
    /Qm[1-9A-HJ-NP-Za-km-z]{44}|baf[a-z0-9]{56}/g
  )
  if (ipfsMatches) {
    hashes.push(...ipfsMatches)
  }

  // Extract from ipfs:// URIs
  const ipfsUriMatches = contribution.description.match(
    /ipfs:\/\/([Qm][1-9A-HJ-NP-Za-km-z]{44}|baf[a-z0-9]{56})/g
  )
  if (ipfsUriMatches) {
    ipfsUriMatches.forEach((uri) => {
      const hash = uri.replace('ipfs://', '')
      hashes.push(hash)
    })
  }

  // Extract from IPFS gateway URLs
  const gatewayMatches = contribution.description.match(
    /https?:\/\/[^\/]*ipfs[^\/]*\/(?:ipfs\/)?([Qm][1-9A-HJ-NP-Za-km-z]{44}|baf[a-z0-9]{56})/g
  )
  if (gatewayMatches) {
    gatewayMatches.forEach((url) => {
      const match = url.match(/([Qm][1-9A-HJ-NP-Za-km-z]{44}|baf[a-z0-9]{56})/)
      if (match) {
        hashes.push(match[1])
      }
    })
  }

  // Extract from markdown image syntax ![alt](ipfs://hash) or ![alt](https://gateway/ipfs/hash)
  const markdownImageMatches = contribution.description.match(
    /!\[.*?\]\((?:ipfs:\/\/|https?:\/\/[^\/]*ipfs[^\/]*\/(?:ipfs\/)?)([Qm][1-9A-HJ-NP-Za-km-z]{44}|baf[a-z0-9]{56})[^\)]*\)/g
  )
  if (markdownImageMatches) {
    markdownImageMatches.forEach((match) => {
      const hashMatch = match.match(
        /([Qm][1-9A-HJ-NP-Za-km-z]{44}|baf[a-z0-9]{56})/
      )
      if (hashMatch) {
        hashes.push(hashMatch[1])
      }
    })
  }

  // Log and add unique hashes
  const uniqueHashes = [...new Set(hashes)]
  uniqueHashes.forEach((hash) => {
    usedIPFSHashes.add(hash)
  })

  return uniqueHashes
}

// Inline getContributions function
async function getContributions(): Promise<Contribution[]> {
  const circleId = 29837

  // GraphQL query to get all contributions in the circle
  const getContributionsQuery = gql`
    query GetContributions($circle_id: bigint!) {
      contributions(
        where: { circle_id: { _eq: $circle_id } }
        order_by: { created_at: desc }
      ) {
        id
        description
        created_at
        user_id
        circle_id
        profile_id
      }
    }
  `

  if (!coordinapeClient) {
    throw new Error('COORDINAPE_API_KEY environment variable is not set')
  }

  try {
    const res = await coordinapeClient.request<{
      contributions: Contribution[]
    }>(getContributionsQuery, { circle_id: circleId })
    return res.contributions
  } catch (error: any) {
    console.error('getContributions: Error:', error)
    if (error.response?.errors) {
      console.error('getContributions: GraphQL errors:', error.response.errors)
      const errors = error.response.errors
      if (errors.some((e: any) => e.message.includes('permission'))) {
        throw new Error(
          "You don't have permission to view circle contributions."
        )
      } else if (errors.some((e: any) => e.message.includes('circle'))) {
        throw new Error(
          'Unable to access the Coordinape circle. Please contact support.'
        )
      }
    }
    throw error
  }
}

// Function to process all Coordinape contributions and extract IPFS hashes
async function fetchAllCoordinapeContributionIPFSHashes() {
  try {
    const contributions = await getContributions()
    const contributionIPFSHashes = new Set<string>()

    let totalHashesFound = 0

    for (const contribution of contributions) {
      const hashes = extractIPFSHashesFromContribution(
        contribution,
        contributionIPFSHashes
      )
      totalHashesFound += hashes.length
    }

    console.log(`Coordinape contributions: ${contributions.length}`)
    console.log(
      `Coordinape contribution CIDs: ${totalHashesFound} (${contributionIPFSHashes.size} unique)`
    )

    return Array.from(contributionIPFSHashes)
  } catch (error) {
    console.error('❌ Error fetching Coordinape contributions:', error)
    // Don't fail the entire process if Coordinape is unavailable
    // Just log the error and return empty array
    return []
  }
}

async function main() {
  const allHatCIDs = await fetchAllHatMetadataCIDs()
  // Get all pinned CIDs from Pinata
  const allPinnedCIDs = await listAllPinnedCIDs()

  // Get all responses from typeform forms with rate limiting
  const allResponseIds: string[] = []
  const responsesByForm: { [formId: string]: string[] } = {}
  const usedTypeformResponseIds = new Set<string>()
  const responseIdToFormMap: { [responseId: string]: string } = {} // Add this new mapping

  try {
    const responsePromises = FORM_IDS.map(
      (formId, index) =>
        new Promise(async (resolve) => {
          // Add delay between requests for rate limiting
          await new Promise((r) => setTimeout(r, index * 200))
          const responses = await getAllResponsesFromTypeform(formId)
          resolve({ formId, responses })
        })
    )

    const results = await Promise.all(responsePromises)

    for (const result of results as any[]) {
      const { formId, responses } = result
      if (responses && responses.items) {
        const formResponseIds = responses.items.map(
          (item: any) => item.response_id
        )
        responsesByForm[formId] = formResponseIds
        allResponseIds.push(...formResponseIds)

        // Map each response ID to its form ID
        formResponseIds.forEach((responseId: string) => {
          responseIdToFormMap[responseId] = formId
        })
      } else {
        console.log(`Form ${formId}: No responses or error`)
        responsesByForm[formId] = []
      }
    }
  } catch (error) {
    console.error('Error fetching Typeform responses:', error)
    process.exit(1)
  }

  // Get marketplace table names dynamically
  const [arbitrumMarketplaceTableName, sepoliaMarketplaceTableName] =
    await Promise.all([
      getMarketplaceTableName('arbitrum'),
      getMarketplaceTableName('sepolia'),
    ])

  // Get all data from Tableland tables that could contain IPFS hashes
  try {
    const tablelandPromises = [
      // Citizens (profile images)
      new Promise(async (resolve) => {
        await new Promise((r) => setTimeout(r, 0))
        const result = await queryTable(
          arbitrum,
          `SELECT * FROM ${CITIZEN_TABLE_NAMES['arbitrum']}`
        )
        resolve({ type: 'arbitrumCitizens', data: result })
      }),
      new Promise(async (resolve) => {
        await new Promise((r) => setTimeout(r, 200))
        const result = await queryTable(
          sepolia,
          `SELECT * FROM ${CITIZEN_TABLE_NAMES['sepolia']}`
        )
        resolve({ type: 'sepoliaCitizens', data: result })
      }),

      // Teams (team images/logos)
      new Promise(async (resolve) => {
        await new Promise((r) => setTimeout(r, 400))
        const result = await queryTable(
          arbitrum,
          `SELECT * FROM ${TEAM_TABLE_NAMES['arbitrum']}`
        )
        resolve({ type: 'arbitrumTeams', data: result })
      }),
      new Promise(async (resolve) => {
        await new Promise((r) => setTimeout(r, 600))
        const result = await queryTable(
          sepolia,
          `SELECT * FROM ${TEAM_TABLE_NAMES['sepolia']}`
        )
        resolve({ type: 'sepoliaTeams', data: result })
      }),

      // Missions (mission images/metadata + JuiceBox metadata)
      new Promise(async (resolve) => {
        await new Promise((r) => setTimeout(r, 800))
        const result = await queryTable(
          arbitrum,
          `SELECT * FROM ${MISSION_TABLE_NAMES['arbitrum']}`
        )
        resolve({ type: 'arbitrumMissions', data: result })
      }),
      new Promise(async (resolve) => {
        await new Promise((r) => setTimeout(r, 1000))
        const result = await queryTable(
          sepolia,
          `SELECT * FROM ${MISSION_TABLE_NAMES['sepolia']}`
        )
        resolve({ type: 'sepoliaMissions', data: result })
      }),

      // Projects (project images/metadata)
      new Promise(async (resolve) => {
        await new Promise((r) => setTimeout(r, 1200))
        const result = await queryTable(
          arbitrum,
          `SELECT * FROM ${PROJECT_TABLE_NAMES['arbitrum']}`
        )
        resolve({ type: 'arbitrumProjects', data: result })
      }),
      new Promise(async (resolve) => {
        await new Promise((r) => setTimeout(r, 1400))
        const result = await queryTable(
          sepolia,
          `SELECT * FROM ${PROJECT_TABLE_NAMES['sepolia']}`
        )
        resolve({ type: 'sepoliaProjects', data: result })
      }),

      // Marketplace listings (listing images/metadata)
      new Promise(async (resolve) => {
        await new Promise((r) => setTimeout(r, 1600))
        if (arbitrumMarketplaceTableName) {
          const result = await queryTable(
            arbitrum,
            `SELECT * FROM ${arbitrumMarketplaceTableName}`
          )
          resolve({ type: 'arbitrumMarketplace', data: result })
        } else {
          console.warn('⚠️  Could not get Arbitrum marketplace table name')
          resolve({ type: 'arbitrumMarketplace', data: [] })
        }
      }),
      new Promise(async (resolve) => {
        await new Promise((r) => setTimeout(r, 1800))
        if (sepoliaMarketplaceTableName) {
          const result = await queryTable(
            sepolia,
            `SELECT * FROM ${sepoliaMarketplaceTableName}`
          )
          resolve({ type: 'sepoliaMarketplace', data: result })
        } else {
          console.warn('⚠️  Could not get Sepolia marketplace table name')
          resolve({ type: 'sepoliaMarketplace', data: [] })
        }
      }),
    ]

    const tablelandResults = await Promise.all(tablelandPromises)

    // Process and validate results
    const dataMap: { [key: string]: any } = {}
    for (const result of tablelandResults as any[]) {
      const { type, data } = result

      if (!data) {
        console.error(`❌ Failed to get data for ${type}`)
        process.exit(1)
      }

      dataMap[type] = data
    }

    const {
      arbitrumCitizens,
      sepoliaCitizens,
      arbitrumTeams,
      sepoliaTeams,
      arbitrumMissions,
      sepoliaMissions,
      arbitrumProjects,
      sepoliaProjects,
      arbitrumMarketplace,
      sepoliaMarketplace,
    } = dataMap

    console.log('\n=== DATA SUMMARY ===')
    console.log(`Total Typeform responses: ${allResponseIds.length}`)
    console.log(`Arbitrum Citizens: ${arbitrumCitizens?.length || 0}`)
    console.log(`Sepolia Citizens: ${sepoliaCitizens?.length || 0}`)
    console.log(`Arbitrum Teams: ${arbitrumTeams?.length || 0}`)
    console.log(`Sepolia Teams: ${sepoliaTeams?.length || 0}`)
    console.log(`Arbitrum Missions: ${arbitrumMissions?.length || 0}`)
    console.log(`Sepolia Missions: ${sepoliaMissions?.length || 0}`)
    console.log(`Arbitrum Projects: ${arbitrumProjects?.length || 0}`)
    console.log(`Sepolia Projects: ${sepoliaProjects?.length || 0}`)
    console.log(`Arbitrum Marketplace: ${arbitrumMarketplace?.length || 0}`)
    console.log(`Sepolia Marketplace: ${sepoliaMarketplace?.length || 0}`)
    console.log(`Hats CIDs: ${allHatCIDs?.size || 0}`)
    console.log(`Pinned CIDs: ${allPinnedCIDs?.length || 0}`)

    const usedIPFSHashes = new Set<string>()
    const criticalIssues = []
    const validationStats = {
      totalRecordsProcessed: 0,
      recordsWithIPFS: 0,
      totalIPFSHashesFound: 0,
      juiceboxMetadataFetched: 0,
      juiceboxMetadataFailed: 0,
      hatHashesFound: 0,
      typeformResponsesFound: 0,
      recordsWithTypeformIds: 0,
      citizensWithTypeformIds: 0,
      teamsWithTypeformIds: 0,
      missingTypeformIds: 0,
      websiteMetadataIPFSHashesFound: 0,
      marketplaceListingsWithImages: 0,
      marketplaceListingsMissingImages: 0,
      nanceProposalHashesFound: 0,
      coordinapeContributionHashesFound: 0,
    }

    // Function to extract and validate Typeform response IDs
    function extractTypeformResponseIds(item: any, source: string): string[] {
      const responseIds: string[] = []

      // For Citizens and Teams, the field is specifically "formId"
      if (source.includes('Citizens') || source.includes('Teams')) {
        const formId = item.formId
        if (formId && typeof formId === 'string' && formId.trim()) {
          responseIds.push(formId.trim())
          usedTypeformResponseIds.add(formId.trim())
        }
      } else {
        // For other sources, check multiple possible field names
        const typeformFields = [
          'formId',
          'form_id',
          'responseId',
          'response_id',
          'typeformId',
          'typeform_id',
          'typeformResponseId',
          'typeform_response_id',
          'submissionId',
          'submission_id',
        ]

        typeformFields.forEach((field) => {
          const value = item[field]
          if (value && typeof value === 'string' && value.trim()) {
            responseIds.push(value.trim())
            usedTypeformResponseIds.add(value.trim())
          }
        })
      }

      // Also check if the entire item might be a response ID (for simple arrays)
      if (typeof item === 'string' && item.trim()) {
        responseIds.push(item.trim())
        usedTypeformResponseIds.add(item.trim())
      }

      return responseIds
    }

    // Enhanced IPFS hash extraction with comprehensive validation
    function extractIPFSFromString(
      text: string,
      source: string,
      field: string
    ): string[] {
      if (!text || typeof text !== 'string') return []

      const hashes: string[] = []

      // Extract raw IPFS hashes (both v0 and v1)
      const ipfsMatches = text.match(
        /Qm[1-9A-HJ-NP-Za-km-z]{44}|baf[a-z0-9]{56}/g
      )
      if (ipfsMatches) {
        hashes.push(...ipfsMatches)
      }

      // Extract from ipfs:// URIs
      const ipfsUriMatches = text.match(
        /ipfs:\/\/([Qm][1-9A-HJ-NP-Za-km-z]{44}|baf[a-z0-9]{56})/g
      )
      if (ipfsUriMatches) {
        ipfsUriMatches.forEach((uri) => {
          const hash = uri.replace('ipfs://', '')
          hashes.push(hash)
        })
      }

      // Log all found hashes
      hashes.forEach((hash) => {
        usedIPFSHashes.add(hash)
      })

      return hashes
    }

    // Helper function to extract IPFS hashes and Typeform IDs from various data formats with validation
    async function extractIPFSHashes(data: any[], source: string) {
      if (!data || !Array.isArray(data)) {
        console.warn(`⚠️  No data or invalid data format for ${source}`)
        return
      }

      let recordsWithIPFS = 0
      let recordsWithTypeformIds = 0

      for (const item of data) {
        validationStats.totalRecordsProcessed++
        let foundHashesInRecord = 0
        let foundTypeformIdsInRecord = 0

        // Extract Typeform response IDs (for Citizens and Teams)
        if (source.includes('Citizens') || source.includes('Teams')) {
          const typeformIds = extractTypeformResponseIds(item, source)
          foundTypeformIdsInRecord += typeformIds.length
          validationStats.typeformResponsesFound += typeformIds.length

          if (typeformIds.length > 0) {
            recordsWithTypeformIds++
            validationStats.recordsWithTypeformIds++

            if (source.includes('Citizens')) {
              validationStats.citizensWithTypeformIds++
            } else if (source.includes('Teams')) {
              validationStats.teamsWithTypeformIds++
            }
          } else {
            // Only flag as missing if it's Arbitrum (production)
            // Sepolia (testnet) records can have missing formIds
            if (source.includes('arbitrum')) {
              validationStats.missingTypeformIds++
              console.warn(
                `⚠️  ${source} record missing formId: ${JSON.stringify(item)}`
              )
            }
          }
        }

        // Check all string fields for IPFS hashes
        for (const [key, value] of Object.entries(item)) {
          if (typeof value === 'string') {
            const hashes = extractIPFSFromString(value, source, key)
            foundHashesInRecord += hashes.length
            validationStats.totalIPFSHashesFound += hashes.length
          }
        }

        if (foundHashesInRecord > 0) {
          recordsWithIPFS++
          validationStats.recordsWithIPFS++
        }

        // For missions, fetch and parse JuiceBox metadata using project ID
        if (source.includes('Missions')) {
          const projectId = item.projectId || item.project_id

          if (
            projectId &&
            (typeof projectId === 'number' || typeof projectId === 'string')
          ) {
            try {
              const projectMetadataResult = await fetchJuiceBoxProjectMetadata(
                projectId,
                source.includes('arbitrum')
                  ? jbControllerContractArbitrum
                  : jbControllerContractSepolia
              )

              if (projectMetadataResult) {
                validationStats.juiceboxMetadataFetched++
                const { metadata, metadataURI } = projectMetadataResult

                // CRITICAL VALIDATION: Check for required metadataURI and logoURI
                if (!metadataURI) {
                  criticalIssues.push(
                    `Mission project ${projectId} missing metadataURI`
                  )
                } else {
                  usedIPFSHashes.add(metadataURI)
                  validationStats.totalIPFSHashesFound++
                }

                if (!metadata.logoUri) {
                  criticalIssues.push(
                    `Mission project ${projectId} missing logoURI in metadata`
                  )
                } else {
                  // Check if logoURI has gateway and extract IPFS hash
                  let logoHash = null
                  if (metadata.logoUri.includes('/ipfs/')) {
                    const ipfsIndex = metadata.logoUri.indexOf('/ipfs/')
                    logoHash = metadata.logoUri.substring(ipfsIndex + 6)
                  } else if (metadata.logoUri.startsWith('ipfs://')) {
                    logoHash = metadata.logoUri.replace('ipfs://', '')
                  } else if (isValidIPFSHash(metadata.logoUri)) {
                    logoHash = metadata.logoUri
                  }

                  if (logoHash) {
                    usedIPFSHashes.add(logoHash)
                    validationStats.totalIPFSHashesFound++
                  }
                }

                // Recursively search the metadata object for IPFS hashes
                const searchForIPFS = (obj: any, path: string = '') => {
                  if (typeof obj === 'string') {
                    const hashes = extractIPFSFromString(
                      obj,
                      `${source} JuiceBox metadata`,
                      path || 'root'
                    )
                    validationStats.totalIPFSHashesFound += hashes.length
                  } else if (typeof obj === 'object' && obj !== null) {
                    for (const [key, value] of Object.entries(obj)) {
                      searchForIPFS(value, path ? `${path}.${key}` : key)
                    }
                  }
                }

                searchForIPFS(metadata)
              } else {
                validationStats.juiceboxMetadataFailed++
                console.warn(
                  `⚠️  Failed to fetch JuiceBox metadata for project ${projectId}`
                )
              }
            } catch (error) {
              validationStats.juiceboxMetadataFailed++
              console.error(
                `❌ Error fetching JuiceBox metadata for project ${projectId}:`,
                error
              )
            }

            // Small delay to avoid overwhelming services
            await new Promise((resolve) => setTimeout(resolve, 200))
          } else if (source.includes('Missions')) {
            console.warn(
              `⚠️  Mission record missing valid projectId: ${JSON.stringify(
                item
              )}`
            )
          }
        }

        // Validate Citizens and Teams have images (REQUIRED for all records)
        if (source.includes('Citizens') || source.includes('Teams')) {
          let recordsWithImages = 0
          let recordsWithoutImages = 0

          for (const item of data) {
            let hasValidImage = false

            // Check for image field with IPFS hash
            if (
              item.image &&
              typeof item.image === 'string' &&
              item.image.trim()
            ) {
              const imageValue = item.image.trim()
              // Check if it's a valid IPFS hash (with or without ipfs:// prefix)
              const cleanHash = imageValue.startsWith('ipfs://')
                ? imageValue.replace('ipfs://', '')
                : imageValue

              if (isValidIPFSHash(cleanHash)) {
                hasValidImage = true
                recordsWithImages++
                // Make sure it's added to our used set
                usedIPFSHashes.add(cleanHash)
              }
            }

            if (!hasValidImage) {
              recordsWithoutImages++
              console.warn(
                `❌ ${source} record missing valid image: ${JSON.stringify(
                  item
                )}`
              )
            }
          }

          // CRITICAL: All Citizens and Teams must have images
          if (recordsWithoutImages > 0) {
            criticalIssues.push(
              `${recordsWithoutImages} ${source} records are missing valid images - ALL should have images!`
            )
          }
        }

        // STRICT VALIDATION for Marketplace listings - ALL must have images
        if (source.includes('Marketplace')) {
          let hasValidImage = false

          // Check for image field with IPFS hash
          if (
            item.image &&
            typeof item.image === 'string' &&
            item.image.trim()
          ) {
            const imageValue = item.image.trim()
            // Check if it's a valid IPFS hash (with or without ipfs:// prefix)
            const cleanHash = imageValue.startsWith('ipfs://')
              ? imageValue.replace('ipfs://', '')
              : imageValue

            if (isValidIPFSHash(cleanHash)) {
              hasValidImage = true
              validationStats.marketplaceListingsWithImages++
              // Make sure it's added to our used set
              usedIPFSHashes.add(cleanHash)
            }
          }

          if (!hasValidImage) {
            validationStats.marketplaceListingsMissingImages++
            criticalIssues.push(
              `❌ CRITICAL: ${source} listing missing valid image - ID: ${item.id}, Title: "${item.title}" - ALL marketplace listings MUST have valid IPFS images!`
            )
            console.error(
              `❌ CRITICAL: ${source} listing missing valid image:`,
              JSON.stringify(item, null, 2)
            )
          }
        }
      }
    }

    allHatCIDs.forEach((hash) => {
      usedIPFSHashes.add(hash)
      validationStats.hatHashesFound++
    })

    websiteMetadataIPFSHashes.forEach((hash) => {
      usedIPFSHashes.add(hash)
      validationStats.websiteMetadataIPFSHashesFound++
    })

    const nanceProposalHashes = await fetchAllNanceProposalIPFSHashes()
    nanceProposalHashes.forEach((hash) => {
      usedIPFSHashes.add(hash)
    })
    validationStats.nanceProposalHashesFound = nanceProposalHashes.length
    console.log(`Nance proposal CIDs: ${nanceProposalHashes.length}`)

    const coordinapeContributionHashes =
      await fetchAllCoordinapeContributionIPFSHashes()
    coordinapeContributionHashes.forEach((hash) => {
      usedIPFSHashes.add(hash)
    })
    validationStats.coordinapeContributionHashesFound =
      coordinapeContributionHashes.length
    console.log(
      `Coordinape contribution CIDs: ${coordinapeContributionHashes.length}`
    )

    // Extract IPFS hashes and Typeform IDs from all data sources
    console.log('\n=== 🔍 EXTRACTING IPFS HASHES AND TYPEFORM IDS ===')
    await extractIPFSHashes(arbitrumCitizens, 'arbitrumCitizens')
    await extractIPFSHashes(sepoliaCitizens, 'sepoliaCitizens')
    await extractIPFSHashes(arbitrumTeams, 'arbitrumTeams')
    await extractIPFSHashes(sepoliaTeams, 'sepoliaTeams')
    await extractIPFSHashes(arbitrumMissions, 'arbitrumMissions')
    await extractIPFSHashes(sepoliaMissions, 'sepoliaMissions')
    await extractIPFSHashes(arbitrumProjects, 'arbitrumProjects')
    await extractIPFSHashes(sepoliaProjects, 'sepoliaProjects')
    await extractIPFSHashes(arbitrumMarketplace, 'arbitrumMarketplace')
    await extractIPFSHashes(sepoliaMarketplace, 'sepoliaMarketplace')

    // Critical validation checks
    if (validationStats.juiceboxMetadataFailed > 0) {
      criticalIssues.push(
        `${validationStats.juiceboxMetadataFailed} JuiceBox metadata fetches failed`
      )
    }

    if (validationStats.totalIPFSHashesFound === 0) {
      criticalIssues.push('No IPFS hashes found at all - this seems wrong!')
    }

    if (usedIPFSHashes.size < validationStats.totalIPFSHashesFound) {
      criticalIssues.push(
        `Hash count mismatch: found ${validationStats.totalIPFSHashesFound} but only ${usedIPFSHashes.size} unique`
      )
    }

    // Marketplace validation - CRITICAL if any listings are missing images
    if (validationStats.marketplaceListingsMissingImages > 0) {
      criticalIssues.push(
        `🚨 CRITICAL: ${validationStats.marketplaceListingsMissingImages} marketplace listings are missing valid IPFS images - ALL listings MUST have images!`
      )
    }

    // Typeform validation checks - only for Arbitrum (production)
    const totalArbitrumCitizensAndTeams =
      (arbitrumCitizens?.length || 0) + (arbitrumTeams?.length || 0)

    if (
      totalArbitrumCitizensAndTeams > 0 &&
      validationStats.citizensWithTypeformIds === 0 &&
      validationStats.teamsWithTypeformIds === 0
    ) {
      criticalIssues.push(
        'No Typeform response IDs found in Arbitrum Citizens/Teams - this seems wrong!'
      )
    }

    if (validationStats.missingTypeformIds > 0) {
      criticalIssues.push(
        `${validationStats.missingTypeformIds} Arbitrum Citizens/Teams records are missing formId - these might be orphaned!`
      )
    }

    if (criticalIssues.length > 0) {
      console.log(`\n🚨 CRITICAL ISSUES DETECTED:`)
      criticalIssues.forEach((issue) => console.log(`❌ ${issue}`))
      console.log(
        `\n⚠️  STOPPING EXECUTION - Please review and fix issues before proceeding`
      )
      process.exit(1)
    }

    console.log(`\n=== 📈 ANALYSIS SUMMARY ===`)
    console.log(`Total unique IPFS hashes found: ${usedIPFSHashes.size}`)
    console.log(`Total pinned CIDs in Pinata: ${allPinnedCIDs?.length || 0}`)
    console.log(
      `Total unique Typeform response IDs found: ${usedTypeformResponseIds.size}`
    )
    console.log(
      `Marketplace listings with images: ${validationStats.marketplaceListingsWithImages}`
    )
    console.log(
      `Marketplace listings missing images: ${validationStats.marketplaceListingsMissingImages}`
    )

    // Find unused CIDs (pinned but not referenced in any table)
    const unusedCIDs =
      allPinnedCIDs?.filter((cid) => !usedIPFSHashes.has(cid)) || []

    // Debug: Expected vs actual math
    const expectedUnused = (allPinnedCIDs?.length || 0) - usedIPFSHashes.size

    if (expectedUnused !== unusedCIDs.length) {
      console.log(
        `⚠️  MISMATCH: Expected ${expectedUnused} but got ${unusedCIDs.length}`
      )
      // Check if there are duplicate CIDs in allPinnedCIDs
      const uniquePinnedCIDs = new Set(allPinnedCIDs || [])
      if (uniquePinnedCIDs.size !== (allPinnedCIDs?.length || 0)) {
        console.log(
          `Found ${
            (allPinnedCIDs?.length || 0) - uniquePinnedCIDs.size
          } duplicate CIDs in Pinata`
        )
      }

      // Debug: Find the overlap between usedIPFSHashes and pinnedCIDs
      const pinnedSet = new Set(allPinnedCIDs || [])
      const foundInBoth = Array.from(usedIPFSHashes).filter((hash) =>
        pinnedSet.has(hash)
      )
      console.log(
        `Missing overlap: ${
          usedIPFSHashes.size - foundInBoth.length
        } hashes in usedIPFSHashes but not in Pinata`
      )

      // Show some examples of the mismatch
      const notInPinata = Array.from(usedIPFSHashes)
        .filter((hash) => !pinnedSet.has(hash))
        .slice(0, 5)
      if (notInPinata.length > 0) {
        console.log(`Examples of hashes not in Pinata:`, notInPinata)
      }
    }

    console.log(`Unused CIDs (candidates for unpinning): ${unusedCIDs.length}`)

    // Find unused Typeform responses (all responses minus used ones)
    const unusedTypeformResponses = allResponseIds
      .filter((responseId) => !usedTypeformResponseIds.has(responseId))
      .map((responseId) => ({
        responseId,
        formId: responseIdToFormMap[responseId],
      }))

    console.log(
      `Unused Typeform responses (candidates for deletion): ${unusedTypeformResponses.length}`
    )

    // console.log(`\n=== START DELETION ===`)
    // for (const cid of unusedCIDs) {
    //   console.log(`Unpinning CID ${cid}`)
    //   await upinFromPinata(cid)
    //   await new Promise((resolve) => setTimeout(resolve, 1000))
    // }
    // for (const { responseId, formId } of unusedTypeformResponses) {
    //   console.log(`Deleting response ${responseId} from form ${formId}`)
    //   await deleteResponseFromTypeform(formId, responseId)
    //   await new Promise((resolve) => setTimeout(resolve, 1000))
    // }
    // console.log(`\n=== END DELETION ===`)
  } catch (error) {
    console.error('❌ Error fetching Tableland data:', error)
    process.exit(1)
  }
}

main()
  .then(() => process.exit(0))
  .catch(() => {
    process.exit(1)
  })
