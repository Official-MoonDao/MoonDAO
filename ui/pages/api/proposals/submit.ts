import ProjectTableABI from 'const/abis/ProjectTable.json'
import { getServerSession } from 'next-auth/next'
import ProjectTeamCreatorABI from 'const/abis/ProjectTeamCreator.json'
import {
  PROJECT_TABLE_ADDRESSES,
  PROJECT_TABLE_NAMES,
  DEFAULT_CHAIN_V5,
  PROJECT_CREATOR_ADDRESSES,
} from 'const/config'
import { getPrivyUserData } from '@/lib/privy'
import { DISCORD_TO_ETH_ADDRESS } from 'const/usernames'
import { ethers } from 'ethers'
import { getSubmissionQuarter } from 'lib/utils/dates'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import { prepareContractCall, sendAndConfirmTransaction, getContract } from 'thirdweb'
import { createHSMWallet } from '@/lib/google/hsm-signer'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'
import { authOptions } from '@/pages/api/auth/[...nextauth]'

const chain = DEFAULT_CHAIN_V5
const chainSlug = getChainSlug(chain)
const PROD_PROPOSALS_FORUM_ID = '1034923662442254356'
const TEST_PROPOSALS_FORUM_ID = '1446583124388741252'
const proposalsForumId =
  process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? PROD_PROPOSALS_FORUM_ID : TEST_PROPOSALS_FORUM_ID // proposals || test-forum

// Extract abstract section from markdown using regex (deterministic, reliable)
function extractAbstractFromMarkdown(body: string): string | null {
  // Try markdown heading format: # Abstract, ## Abstract, etc.
  const headingPattern = /^#{1,6}\s*\*{0,2}Abstract\*{0,2}\s*$/im
  const headingMatch = headingPattern.exec(body)
  if (headingMatch && headingMatch.index !== undefined) {
    const rest = body.slice(headingMatch.index + headingMatch[0].length)
    const nextHeading = rest.search(/^#{1,6}\s/m)
    const content = nextHeading !== -1 ? rest.slice(0, nextHeading) : rest
    const trimmed = content.trim()
    if (trimmed) return trimmed
  }

  // Try bold/plain format: **Abstract** or just "Abstract" on its own line
  const boldPattern = /^\*{1,2}Abstract\*{1,2}\s*$/im
  const boldMatch = boldPattern.exec(body)
  if (boldMatch && boldMatch.index !== undefined) {
    const rest = body.slice(boldMatch.index + boldMatch[0].length)
    const nextSection = rest.search(/^(?:#{1,6}\s|\*{1,2}[A-Z])/m)
    const content = nextSection !== -1 ? rest.slice(0, nextSection) : rest
    const trimmed = content.trim()
    if (trimmed) return trimmed
  }

  return null
}

// Fallback: parse abstract out of proposal body via LLM
async function getAbstractViaLLM(proposalBody: string): Promise<string | null> {
  const thePrompt =
    `You are reading a DAO proposal written in markdown. Extract the Abstract section from the proposal.\n` +
    `Return ONLY the text of the Abstract section, or null if not found.\n\n` +
    `Proposal:\n${proposalBody}`

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        messages: [{ role: 'user', content: thePrompt }],
        temperature: 0,
      }),
    })

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content?.trim() || null
    return text
  } catch (error) {
    console.error('LLM abstract extraction failed:', error)
    return null
  }
}

async function getAbstract(proposalBody: string): Promise<string | null> {
  const regexResult = extractAbstractFromMarkdown(proposalBody)
  if (regexResult) return regexResult

  return getAbstractViaLLM(proposalBody)
}

// Parse addresses out of proposal body via LLM
async function getAddresses(proposalBody: string, patterns: string[]): Promise<{ addresses: string[]; unresolved: string[] }> {
  const roleDescription = patterns.join(' or ')
  const thePrompt =
    `You are reading a DAO proposal written in markdown. There will be Team Rocketeers, and Intial Team, and Multi-sig signers. Extract the usernames and corresponding Ethereum addresses for just the ${roleDescription}.\n` +
    `Look for Discord handles (usernames), Ethereum addresses (0x...) and ENS names (xxx.eth).\n` +
    `Return ONLY a valid JSON string which is an array of objects with the keys \"username\", \"address\" and \"ens\".\n` +
    `- Set missing values to null\n` +
    `If none are found, return an empty array.\n\n` +
    `Proposal:\n${proposalBody}`

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [{ role: 'user', content: thePrompt }],
        temperature: 0,
      }),
    })

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content?.trim() || '[]'
    let parsed
    try {
      // LLMs sometimes wrap JSON in markdown code fences, strip them
      let cleanText = text
      const jsonMatch = cleanText.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) {
        cleanText = jsonMatch[1].trim()
      }
      parsed = JSON.parse(cleanText)
      if (!Array.isArray(parsed)) {
        parsed = []
      }
    } catch (e) {
      console.log('Failed to parse JSON from LLM response:', text)
      console.log('error', e)
      parsed = []
    }

    const addresses: string[] = []
    const unresolved: string[] = []
    const provider = new ethers.providers.JsonRpcProvider('https://eth.llamarpc.com')

    for (const item of parsed) {
      const username = item.username
      const usernameWithoutAt = typeof username === 'string' ? username.replace(/@/g, '') : ''
      const ens = item.ens
      let address = item.address

      // If no address but we have a username, try to resolve from mapping
      if (!address && username) {
        const mappedAddress = DISCORD_TO_ETH_ADDRESS[usernameWithoutAt]
        if (mappedAddress && mappedAddress.trim() !== '') {
          address = mappedAddress
        }
      }
      if (!address && ens) {
        try {
          address = await provider.resolveName(ens)
        } catch (ensError) {
          console.warn(`Failed to resolve ENS name "${ens}":`, ensError)
        }
      }

      if (address && ethers.utils.isAddress(address)) {
        addresses.push(address)
      } else {
        const label = username || ens || address || 'unknown'
        console.warn(`Could not resolve address for "${label}" (address: ${address}, ens: ${ens})`)
        unresolved.push(label)
      }
    }

    return { addresses, unresolved }
  } catch (error) {
    console.error('LLM address extraction failed:', error)
    return { addresses: [], unresolved: [] }
  }
}

const DEFAULT_MULTISIG_SIGNERS: { label: string; address: string }[] = [
  { label: 'Pablo', address: '0x679d87D8640e66778c3419D164998E720D7495f6' },
  { label: 'Ryan', address: '0xB2d3900807094D4Fe47405871B0C8AdB58E10D42' },
  { label: 'Miguel', address: '0xaf6f2a7643a97b849bd9cf6d3f57e142c5bbb0da' },
  { label: 'Eiman', address: '0xe2d3aC725E6FFE2b28a9ED83bedAaf6672f2C801' },
]

function resolveDefaultSigners(authorAddress: string): string[] {
  const signers = DEFAULT_MULTISIG_SIGNERS.map((s) => s.address)

  if (!signers.some((a) => a.toLowerCase() === authorAddress.toLowerCase())) {
    signers.push(authorAddress)
  }

  return signers
}

interface PinResponse {
  cid: string
}
async function pinBlobOrFile(blob: Blob, name: string): Promise<PinResponse> {
  try {
    const url = 'https://api.pinata.cloud/pinning/pinFileToIPFS'
    const formData = new FormData()
    formData.append('pinataMetadata', JSON.stringify({ name: name }))
    formData.append('pinataOptions', JSON.stringify({ cidVersion: 0 }))
    formData.append('file', blob)
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PINATA_JWT_KEY}`,
      },
      body: formData,
    })
    if (!response.ok) {
      throw new Error(`Error pinning file to IPFS: ${response.status} ${response.statusText}`)
    }

    const jsonData = await response.json()
    return { cid: jsonData.IpfsHash }
  } catch (error) {
    console.error('pinBlobToIPFS failed:', error)
    throw error
  }
}

// Submit a proposal, project based on non-project. Creates a new entry in the table and a new discord thread.
async function POST(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { address, proposalTitle, proposalIPFS, body } = req.body
    const session = await getServerSession(req, res, authOptions)
    if (!session?.accessToken) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const privyUserData = await getPrivyUserData(session.accessToken)
    if (!privyUserData || privyUserData.walletAddresses.length === 0) {
      res.status(401).json({ error: 'No wallet addresses found' })
      return
    }
    let matchedAddress = false
    for (const walletAddress of privyUserData.walletAddresses) {
      if (walletAddress.toLowerCase() == address.toLowerCase()) {
        matchedAddress = true
      }
    }
    if (!matchedAddress) {
      res.status(401).json({ error: 'Address not authorized' })
      return
    }

    const account = await createHSMWallet()
    if (req.body.proposalId) {
      // UPDATE
      const { proposalId, proposalIPFS } = req.body
      const projectTableContract = getContract({
        client: serverClient,
        address: PROJECT_TABLE_ADDRESSES[chainSlug],
        abi: ProjectTableABI as any,
        chain: chain,
      })
      const projectStatement = `SELECT * FROM ${PROJECT_TABLE_NAMES[chainSlug]} WHERE MDP = ${proposalId}`

      const projects = await queryTable(chain, projectStatement)
      const project = projects[0]
      const transaction = prepareContractCall({
        contract: projectTableContract,
        method: 'updateTableCol',
        params: [project.id, 'proposalIPFS', proposalIPFS],
      })
      const receipt = await sendAndConfirmTransaction({
        transaction,
        account,
      })
      res.status(200).json({
        proposalId: proposalId,
      })
    } else {
      // CREATE

      const projectTeamCreatorContract = getContract({
        client: serverClient,
        address: PROJECT_CREATOR_ADDRESSES[chainSlug],
        abi: ProjectTeamCreatorABI as any,
        chain: chain,
      })
      const projectStatement = `SELECT * FROM ${PROJECT_TABLE_NAMES[chainSlug]} ORDER BY MDP DESC`
      const projects = await queryTable(chain, projectStatement)
      let proposalId = 1
      if (projects.length) {
        proposalId = projects[0].MDP + 1
      }

      const signers = resolveDefaultSigners(address)

      let [leadsResult, membersResult, abstractFull] = await Promise.all([
        getAddresses(body, ['Team Rocketeer', 'Project Lead']),
        getAddresses(body, ['Initial Team']),
        getAbstract(body),
      ])

      let leads = leadsResult.addresses
      let members = membersResult.addresses

      // Log parsed data for debugging
      console.log(`[Proposal MDP-${proposalId}] Parsed from document:`, {
        leads,
        members,
        defaultSigners: signers,
        unresolvedMembers: membersResult.unresolved,
        abstractLength: abstractFull?.length || 0,
      })

      // Only allow the first lead to be the lead for smart contract purposes
      const lead = leads[0] || address
      if (leads.length > 1) {
        members = [...leads.slice(1), ...members]
      }

      // Warn if no leads were found
      if (leads.length === 0) {
        console.warn(`[Proposal MDP-${proposalId}] No project lead found in document, using submitter address: ${address}`)
      }

      const abstractText = abstractFull?.slice(0, 1000)

      if (membersResult.unresolved.length > 0) {
        console.warn(`[Proposal MDP-${proposalId}] Unresolved team members (proceeding anyway): ${membersResult.unresolved.join(', ')}`)
      }
      const abstractValid =
        abstractText !== undefined && abstractText !== null && abstractText !== 'null'
      if (!abstractValid) {
        return res.status(400).json({
          error: `Could not find an Abstract section in your proposal. Please make sure your Google Doc includes a section titled "Abstract" with a description of your project.`,
        })
      }

      // parse out tables from proposal body which is in markdown format
      const getHatMetadataIPFS = async function (hatType: string) {
        const hatMetadataBlob = new Blob(
          [
            JSON.stringify({
              type: '1.0',
              data: {
                name: 'MDP-' + proposalId + ' ' + hatType,
                description: proposalTitle,
              },
            }),
          ],
          {
            type: 'application/json',
          }
        )
        const name = `MDP-${proposalId}-${hatType}.json`
        const { cid: hatMetadataIpfsHash } = await pinBlobOrFile(hatMetadataBlob, name)
        return 'ipfs://' + hatMetadataIpfsHash
      }
      const { quarter, year } = getSubmissionQuarter()
      const upfrontPayment = ''
      const [adminHatMetadataIpfs, managerHatMetadataIpfs, memberHatMetadataIpfs] =
        await Promise.allSettled([
          getHatMetadataIPFS('Admin'),
          getHatMetadataIPFS('Manager'),
          getHatMetadataIPFS('Member'),
        ])
      if (
        adminHatMetadataIpfs.status !== 'fulfilled' ||
        managerHatMetadataIpfs.status !== 'fulfilled' ||
        memberHatMetadataIpfs.status !== 'fulfilled'
      ) {
        console.error(
          'Failed to pin hat metadata IPFS: ',
          adminHatMetadataIpfs,
          managerHatMetadataIpfs,
          memberHatMetadataIpfs
        )
      }
      const transaction = prepareContractCall({
        contract: projectTeamCreatorContract,
        method: 'createProjectTeam',
        params: [
          'ipfs://QmUMm4rHbbkcfBCszfFHmBNvHSyPGNVXJZHpcCG4BMEaNY',
          'ipfs://QmT7LKxDAzaJsBafMbe2B1thaoqkvKgj7Y72QQiuQusnzE',
          'ipfs://QmVjgE2pPQjueixuUcpo6h3z4NBMB5S6BeH617vHSwW74m',
          proposalTitle.replace(/'/g, "''"),
          abstractText.replace(/'/g, "''"), // description
          '', // image
          quarter,
          year,
          proposalId,
          proposalIPFS, // proposal ipfs
          'https://moondao.com/project/' + proposalId,
          upfrontPayment,
          lead, // leadAddress,
          members.length > 0 ? members : [address], // members
          signers, // default 3/5 multisig signers
        ],
      })
      const receipt = await sendAndConfirmTransaction({
        transaction,
        account,
      })

      const discordResponse = await fetch(
        `https://discord.com/api/v10/channels/${proposalsForumId}/threads`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
          },
          body: JSON.stringify({
            name: `MDP-${proposalId}: ${proposalTitle}`,
            message: { content: `https://moondao.com/project/${proposalId}` },
          }),
        }
      )
      if (!discordResponse.ok) {
        const responseJson = await discordResponse.json()
        console.error('Failed to create thread on discord: ', responseJson?.message)
      }
      res.status(200).json({
        proposalId: proposalId,
      })
    }
  } catch (e: any) {
    console.error('Error submitting proposal:', e)
    return res.status(400).json({
      error: `Error submitting proposal: ${e?.message || 'An unexpected error occurred'}. Please try again. If the problem persists, submit a ticket in the MoonDAO Discord support channel.`,
    })
  }
}
export default withMiddleware(POST, rateLimit)
