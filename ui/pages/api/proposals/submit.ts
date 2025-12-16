import ProjectTableABI from 'const/abis/ProjectTable.json'
import ProjectTeamCreatorABI from 'const/abis/ProjectTeamCreator.json'
import {
  PROJECT_TABLE_ADDRESSES,
  PROJECT_TABLE_NAMES,
  DEFAULT_CHAIN_V5,
  PROJECT_CREATOR_ADDRESSES,
  DISCORD_GUILD_ID,
} from 'const/config'
import { DISCORD_TO_ETH_ADDRESS } from 'const/usernames'
import { ethers } from 'ethers'
import { getSubmissionQuarter } from 'lib/utils/dates'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import {
  readContract,
  prepareContractCall,
  sendAndConfirmTransaction,
  sendTransaction,
  getContract,
} from 'thirdweb'
import { createHSMWallet } from '@/lib/google/hsm-signer'
import { pinBlobOrFile } from '@/lib/ipfs/pinBlobOrFile'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'

// Configuration constants
const chain = DEFAULT_CHAIN_V5
const chainSlug = getChainSlug(chain)
const PROD_PROPOSALS_FORUM_ID = '1034923662442254356'
const TEST_PROPOSALS_FORUM_ID = '1446583124388741252'
const proposalsForumId =
  process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? PROD_PROPOSALS_FORUM_ID : TEST_PROPOSALS_FORUM_ID // proposals || test-forum

async function getAbstract(proposalBody: string): Promise<string | null> {
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

async function getAddresses(
  proposalBody: string,
  patterns: string[]
): Promise<[string[], string[]]> {
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
      parsed = JSON.parse(text)
    } catch (e) {
      console.log('Failed to parse JSON from LLM response:', text)
      console.log('error', e)
      parsed = []
    }

    const usernames: string[] = []
    const addresses: string[] = []
    const provider = new ethers.providers.JsonRpcProvider('https://eth.llamarpc.com')

    for (const item of parsed) {
      const username = item.username
      const usernameWithoutAt = username.replace(/@/g, '')
      const ens = item.ens
      let address = item.address

      // If no address but we have a username, try to resolve from mapping
      if (!address && username && DISCORD_TO_ETH_ADDRESS[usernameWithoutAt]) {
        address = DISCORD_TO_ETH_ADDRESS[usernameWithoutAt]
      }
      if (!address && ens) {
        address = await provider.resolveName(ens)
      }

      if (username) usernames.push(username)
      if (address) addresses.push(address)
    }

    return [addresses, usernames]
  } catch (error) {
    console.error('LLM address extraction failed:', error)
    return [[], []]
  }
}

async function POST(req: NextApiRequest, res: NextApiResponse) {
  try {
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
      const { address, proposalTitle, proposalIPFS, body } = req.body

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
      var members = []
      var membersUsernames = []
      const [leads, leadsUsernames] = await getAddresses(body, ['Team Rocketeer', 'Project Lead'])
      ;[members, membersUsernames] = await getAddresses(body, ['Initial Team'])
      // Only allow the first lead to be the lead for smart contract purposes
      const lead = leads[0] || address
      if (leads.length > 1) {
        members = [...leads.slice(1), ...members]
        membersUsernames = [...leadsUsernames.slice(1), ...membersUsernames]
      }
      const [signers, signersUsernames] = await getAddresses(body, ['Multi-sig signers'])
      const abstractText = (await getAbstract(body))?.slice(0, 1000)

      const membersValid = members.map((address) => ethers.utils.isAddress(address)).every(Boolean)
      if (!membersValid) {
        return res.status(400).json({
          error: `Could not parse team members. Found: ${members}`,
        })
      }
      const signersValid = signers.map((address) => ethers.utils.isAddress(address)).every(Boolean)
      if (!signersValid) {
        return res.status(400).json({
          error: `Could not parse multi-sig signers. Found: ${signers}`,
        })
      }
      const abstractValid =
        abstractText !== undefined && abstractText !== null && abstractText !== 'null'
      if (!abstractValid) {
        return res.status(400).json({
          error: `Could not parse abstract. Found: ${abstractText}`,
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
        const { cid: hatMetadataIpfsHash } = await pinBlobOrFile(hatMetadataBlob)
        return 'ipfs://' + hatMetadataIpfsHash
      }
      const { quarter, year } = getSubmissionQuarter()
      const upfrontPayment = ''
      //proposal.upfrontPayment
      //? JSON.stringify(proposal.upfrontPayment)
      //: ''
      // FIXME pinipfs not working here
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
          proposalTitle.replace(/'/g, "\\'"),
          abstractText.replace(/'/g, "\\'"), // description
          '', // image
          quarter,
          year,
          proposalId,
          proposalIPFS, // proposal ipfs
          'https://moondao.com/proposal/' + proposalId,
          upfrontPayment,
          lead, // leadAddress,
          members.length > 0 ? members : [address], // members
          signers.length > 0 ? signers : [address], // signers,
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
            message: { content: `https://moondao.com/proposal/${proposalId}` },
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
  } catch (e) {
    console.log('error', e)
    return res.status(400).json({
      error: `Error submitting proposal`,
    })
  }
}
export default withMiddleware(POST, rateLimit)
