import { HatsSubgraphClient } from '@hatsprotocol/sdk-v1-subgraph'
import JBV5ControllerABI from 'const/abis/JBV5Controller.json'
import {
  CITIZEN_TABLE_NAMES,
  TEAM_TABLE_NAMES,
  MISSION_TABLE_NAMES,
  PROJECT_TABLE_NAMES,
  JBV5_CONTROLLER_ADDRESS,
  MOONDAO_HAT_TREE_IDS,
  IPFS_GATEWAY,
} from 'const/config'
import dotenv from 'dotenv'
import {
  createThirdwebClient,
  defineChain,
  getContract,
  readContract,
} from 'thirdweb'
import queryTable from '@/lib/tableland/queryTable'

dotenv.config({ path: '.env.local' })

const infuraKey = process.env.NEXT_PUBLIC_INFURA_KEY
const etherscanApiKey = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY

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

const hatsSubgraphClient = new HatsSubgraphClient({
  config: {
    [42161]: {
      endpoint: `https://gateway-arbitrum.network.thegraph.com/api/${process.env.THE_GRAPH_API_KEY}/subgraphs/id/4CiXQPjzKshBbyK2dgJiknTNWcj8cGUJsopTsXfm5HEk`,
    },
    [11155111]: {
      endpoint: `https://api.studio.thegraph.com/query/55784/hats-v1-sepolia/version/latest`,
    },
  },
})

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
    } else if (
      metadataURI.match(/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/) ||
      metadataURI.match(/^baf[0-9a-z]{56}$/)
    ) {
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
  function createDeepHatProps(depth: number = 4): any {
    if (depth <= 0) {
      return {
        imageUri: true,
        details: true,
        id: true,
      }
    }

    return {
      imageUri: true,
      details: true,
      id: true,
      subHats: {
        props: createDeepHatProps(depth - 1),
      },
    }
  }

  const queryProps = {
    hats: {
      props: createDeepHatProps(4),
    },
  }

  const [arbitrumHats, sepoliaHats] = await Promise.all([
    hatsSubgraphClient.getTree({
      chainId: arbitrum.id,
      treeId: +MOONDAO_HAT_TREE_IDS['arbitrum'],
      props: queryProps,
    }),
    hatsSubgraphClient.getTree({
      chainId: sepolia.id,
      treeId: +MOONDAO_HAT_TREE_IDS['sepolia'],
      props: queryProps,
    }),
  ])

  const usedIPFSHashes = new Set<string>()

  // Process Arbitrum hats
  if (arbitrumHats.hats) {
    arbitrumHats.hats.forEach((hat: any) => {
      extractIPFSHashesFromHat(hat, usedIPFSHashes, 'Arbitrum')
    })
  }

  // Process Sepolia hats
  if (sepoliaHats.hats) {
    sepoliaHats.hats.forEach((hat: any) => {
      extractIPFSHashesFromHat(hat, usedIPFSHashes, 'Sepolia')
    })
  }

  return usedIPFSHashes
}

async function main() {
  const allHats = await fetchAllHatMetadataCIDs()
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
    console.log(`Hats: ${allHats?.size || 0}`)
    console.log(`Pinned CIDs: ${allPinnedCIDs?.length || 0}`)

    const usedIPFSHashes = new Set<string>()
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

                // Add the metadata URI hash itself if it's IPFS
                if (metadataURI) {
                  let metadataHash = metadataURI
                  if (metadataURI.startsWith('ipfs://')) {
                    metadataHash = metadataURI.replace('ipfs://', '')
                  } else if (
                    metadataURI.match(/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/) ||
                    metadataURI.match(/^baf[a-z0-9]{56}$/)
                  ) {
                    metadataHash = metadataURI
                  }

                  // Only add if it's a valid IPFS hash
                  if (
                    metadataHash.match(/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/) ||
                    metadataHash.match(/^baf[a-z0-9]{56}$/)
                  ) {
                    usedIPFSHashes.add(metadataHash)
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

              if (
                cleanHash.match(/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/) ||
                cleanHash.match(/^baf[a-z0-9]{56}$/)
              ) {
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
      }
    }

    allHats.forEach((hash) => {
      usedIPFSHashes.add(hash)
      validationStats.hatHashesFound++
    })

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

    // Critical validation checks
    const criticalIssues = []

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
    console.log(
      `Total unique IPFS hashes found in tables: ${usedIPFSHashes.size}`
    )
    console.log(`Total pinned CIDs in Pinata: ${allPinnedCIDs?.length || 0}`)
    console.log(
      `Total unique Typeform response IDs found: ${usedTypeformResponseIds.size}`
    )

    // Find unused CIDs (pinned but not referenced in any table)
    const unusedCIDs =
      allPinnedCIDs?.filter((cid) => !usedIPFSHashes.has(cid)) || []
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
    // }
    // for (const { responseId, formId } of unusedTypeformResponses) {
    //   console.log(`Deleting response ${responseId} from form ${formId}`)
    //   await deleteResponseFromTypeform(formId, responseId)
    //   // Add a small delay to be polite to the API
    //   await new Promise((resolve) => setTimeout(resolve, 100))
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
