import JBV5Controller from 'const/abis/JBV5Controller.json'
import JBV5TerminalStore from 'const/abis/JBV5TerminalStore.json'
import PayHookABI from 'const/abis/LaunchPadPayHook.json'
import MissionCreator from 'const/abis/MissionCreator.json'
import {
  CITIZEN_TABLE_NAMES,
  DEFAULT_CHAIN_V5,
  GENERAL_CHANNEL_ID,
  IPFS_GATEWAY,
  JB_NATIVE_TOKEN_ADDRESS,
  JB_NATIVE_TOKEN_ID,
  JBV5_CONTROLLER_ADDRESS,
  JBV5_TERMINAL_ADDRESS,
  JBV5_TERMINAL_STORE_ADDRESS,
  MISSION_CREATOR_ADDRESSES,
  MISSION_CROSS_CHAIN_PAY_ADDRESS,
  MISSION_TABLE_NAMES,
  TEST_CHANNEL_ID,
} from 'const/config'
import { DEPLOYED_ORIGIN } from 'const/config'
import { BigNumber, Transaction } from 'ethers'
import { authMiddleware } from 'middleware/authMiddleware'
import withMiddleware from 'middleware/withMiddleware'
import { getContract, readContract, waitForReceipt } from 'thirdweb'
import { ethers5Adapter } from 'thirdweb/adapters/ethers5'
import { getETHPrice } from '@/lib/etherscan'
import { getPrivyUserData } from '@/lib/privy'
import { generatePrettyLinkWithId } from '@/lib/subscription/pretty-links'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug, v4SlugToV5Chain } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'
import { getBlocksInTimeframe } from '@/lib/utils/blocks'
import { formatNumberWithCommasAndDecimals } from '@/lib/utils/numbers'

const chainSlug = getChainSlug(DEFAULT_CHAIN_V5)

const NOTIFICATION_CHANNEL_ID =
  process.env.NEXT_PUBLIC_CHAIN === 'mainnet'
    ? GENERAL_CHANNEL_ID
    : TEST_CHANNEL_ID

const jbTerminalStoreContract = getContract({
  address: JBV5_TERMINAL_STORE_ADDRESS,
  chain: DEFAULT_CHAIN_V5,
  client: serverClient,
  abi: JBV5TerminalStore.abi as any,
})

const jbControllerContract = getContract({
  address: JBV5_CONTROLLER_ADDRESS,
  chain: DEFAULT_CHAIN_V5,
  client: serverClient,
  abi: JBV5Controller.abi as any,
})

const missionCreatorContract = getContract({
  address: MISSION_CREATOR_ADDRESSES[chainSlug],
  chain: DEFAULT_CHAIN_V5,
  client: serverClient,
  abi: MissionCreator.abi as any,
})

// In-memory storage for used transaction hashes to prevent replay attacks
const usedTransactions = new Set<string>()

setInterval(() => {
  usedTransactions.clear()
}, 60 * 60 * 1000)

async function handler(req: any, res: any) {
  if (req.method === 'POST') {
    try {
      const data = req.body
      if (!data) {
        return res.status(400).send({ message: 'Bad request' })
      }

      const { txHash, accessToken, txChainSlug, projectId } = JSON.parse(data)

      if (!txHash || !accessToken || !txChainSlug) {
        return res.status(400).send({ message: 'Missing required fields' })
      }

      const txChain = v4SlugToV5Chain(txChainSlug)
      if (!txChain) {
        return res.status(400).send({ message: 'Invalid transaction chain' })
      }

      // Verify the Privy access token
      const privyUserData = await getPrivyUserData(accessToken)
      if (!privyUserData) {
        return res.status(400).send({ message: 'Invalid access token' })
      }

      const { walletAddresses } = privyUserData
      if (walletAddresses.length === 0) {
        return res.status(400).send({ message: 'No wallet addresses found' })
      }

      // Check if transaction has already been used
      if (usedTransactions.has(txHash)) {
        return res.status(400).send({
          message:
            'This transaction has already been processed for contribution notification',
        })
      }

      // Verify transaction exists and is valid
      const txReceipt = await waitForReceipt({
        client: serverClient,
        chain: txChain,
        transactionHash: txHash,
      })

      if (!txReceipt) {
        return res.status(400).send({
          message: 'Transaction not found',
        })
      }

      // Check if transaction is recent (within 10 minutes)
      const txBlockNumber = parseInt(
        typeof txReceipt.blockNumber === 'object' &&
          txReceipt.blockNumber &&
          'toString' in txReceipt.blockNumber
          ? (txReceipt.blockNumber as any).toString()
          : String(txReceipt.blockNumber)
      )
      const provider = ethers5Adapter.provider.toEthers({
        client: serverClient,
        chain: txChain,
      })
      const currBlockNumber = await provider.getBlockNumber()
      const maxBlocksAge = getBlocksInTimeframe(txChain, 10) // 10 minutes
      const blockAge = currBlockNumber - txBlockNumber

      if (blockAge > maxBlocksAge) {
        return res.status(400).send({
          message: `Transaction is too old. Must be within 10 minutes (${maxBlocksAge} blocks). Transaction is ${blockAge} blocks old.`,
        })
      }

      // Mark transaction as used to prevent replay attacks
      usedTransactions.add(txHash)

      //Make sure the tx is to the JB pay terminal or cross chain pay contract for missions
      if (
        txReceipt.to?.toLowerCase() !== JBV5_TERMINAL_ADDRESS.toLowerCase() &&
        txReceipt.to?.toLowerCase() !==
          MISSION_CROSS_CHAIN_PAY_ADDRESS.toLowerCase()
      ) {
        return res.status(400).send({
          message:
            'Transaction is not to the JBPayTerminal or CrossChainPay contracts',
        })
      }

      const contributionTx = (await provider.getTransaction(
        txHash
      )) as Transaction
      if (!contributionTx) {
        return res.status(400).send({
          message: 'Transaction not found',
        })
      }
      //Make sure ETH was sent w/ the tx, will be used in notification
      const txValue = BigNumber.from(contributionTx.value.toString())
      if (txValue.isZero()) {
        return res.status(400).send({
          message: 'Transaction did not send any ETH',
        })
      }

      //Get the JB project that the user contributed to
      let verifiedProjectId = projectId
      if (
        txReceipt.to?.toLowerCase() === JBV5_TERMINAL_ADDRESS.toLowerCase() &&
        txChain === DEFAULT_CHAIN_V5
      ) {
        const payLog = txReceipt.logs?.[txReceipt.logs.length - 1]
        verifiedProjectId = parseInt(payLog?.topics[3]?.toString() || '0')
        if (!verifiedProjectId) {
          return res.status(400).send({
            message: 'Project ID not found',
          })
        }
      }

      let citizen: any = null
      try {
        const citizenRows: any = await queryTable(
          txChain,
          `SELECT name, id, image, owner FROM ${
            CITIZEN_TABLE_NAMES[chainSlug]
          } WHERE owner = '${txReceipt.from.toLowerCase()}'`
        )

        if (citizenRows.length > 0) {
          citizen = citizenRows[0]
        }
      } catch (err: any) {
        console.log(err)
      }

      //Contribution amount in ETH and USD
      const ethPrice = await getETHPrice()
      if (!ethPrice) {
        return res.status(400).json({
          error: 'Failed to get ETH price',
        })
      }
      const contributionAmountETH = parseFloat(txValue.toString()) / 1e18
      const contributionAmountUSD = contributionAmountETH * ethPrice

      //Mission table data
      const missionRows: any = await queryTable(
        txChain,
        `SELECT id, fundingGoal FROM ${MISSION_TABLE_NAMES[chainSlug]} WHERE projectId = ${verifiedProjectId}`
      )

      if (missionRows.length === 0) {
        return res.status(400).json({
          message: 'Mission not found in mission table',
        })
      }
      const mission = missionRows[0]

      const missionFundingGoal =
        parseFloat(mission.fundingGoal.toString()) / 1e18

      //Mission total raised
      const missionBalance = await readContract({
        contract: jbTerminalStoreContract,
        method: 'balanceOf' as string,
        params: [
          JBV5_TERMINAL_ADDRESS,
          verifiedProjectId,
          JB_NATIVE_TOKEN_ADDRESS,
        ],
      })
      const missionUsedPayoutLimit = await readContract({
        contract: jbTerminalStoreContract,
        method: 'usedPayoutLimitOf' as string,
        params: [
          JBV5_TERMINAL_ADDRESS,
          verifiedProjectId,
          JB_NATIVE_TOKEN_ADDRESS,
          2,
          JB_NATIVE_TOKEN_ID,
        ],
      })

      const missionTotalRaised =
        (parseFloat(missionBalance.toString()) / 1e18 || 0) +
        (parseFloat(missionUsedPayoutLimit.toString()) / 1e18 || 0)
      const missionTotalRaisedUSD = missionTotalRaised * ethPrice
      const percentOfGoalRaised =
        (missionTotalRaised / missionFundingGoal) * 100

      //Mission metadata
      const missionMetadataURI = await readContract({
        contract: jbControllerContract,
        method: 'uriOf' as string,
        params: [verifiedProjectId],
      })
      const missionMetadataRes = await fetch(
        `${IPFS_GATEWAY}${missionMetadataURI}`
      )
      const missionMetadata = await missionMetadataRes.json()

      //Mission deadline
      const payHookAddress: any = await readContract({
        contract: missionCreatorContract,
        method: 'missionIdToPayHook' as string,
        params: [mission.id],
      })

      const payHookContract = getContract({
        client: serverClient,
        address: payHookAddress,
        chain: DEFAULT_CHAIN_V5,
        abi: PayHookABI.abi as any,
      })
      let missionDeadline = null
      if (payHookContract) {
        missionDeadline = await readContract({
          contract: payHookContract,
          method: 'deadline' as string,
          params: [verifiedProjectId],
        })
      }

      //Send discord notification
      try {
        let messageData: any = {}
        const content = `## **${
          citizen?.name
            ? `[${
                citizen.name
              }](${DEPLOYED_ORIGIN}/citizen/${generatePrettyLinkWithId(
                citizen.name,
                citizen.id
              )})`
            : txReceipt.from.slice(0, 6) + '...' + txReceipt.from.slice(-4)
        }** has contributed ${formatNumberWithCommasAndDecimals(
          contributionAmountETH,
          contributionAmountETH >= 1 ? 3 : 5
        )} ETH ($${formatNumberWithCommasAndDecimals(
          contributionAmountUSD
        )}) to the **${`[${missionMetadata.name}](${DEPLOYED_ORIGIN}/mission/${mission.id})`}** mission!\n\n**Total Raised**: ${formatNumberWithCommasAndDecimals(
          missionTotalRaised,
          missionTotalRaised >= 1 ? 3 : 5
        )} ETH ($${formatNumberWithCommasAndDecimals(
          missionTotalRaisedUSD
        )})\n**Progress to Goal**: ${
          percentOfGoalRaised < 1
            ? percentOfGoalRaised.toFixed(4)
            : percentOfGoalRaised.toFixed(0)
        }%\n${
          missionDeadline !== null && missionDeadline !== undefined
            ? `**Deadline**: <t:${missionDeadline.toString()}:R>`
            : ''
        }`

        if (citizen) {
          messageData.embeds = [
            {
              description: content,
              image: {
                url: `${IPFS_GATEWAY}${citizen.image.replace('ipfs://', '')}`,
              },
            },
          ]
        } else {
          messageData.embeds = [
            {
              description: content,
            },
          ]
        }

        const response = await fetch(
          `https://discord.com/api/v10/channels/${NOTIFICATION_CHANNEL_ID}/messages`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
            },
            body: JSON.stringify(messageData),
          }
        )

        if (!response.ok) {
          throw new Error('Failed to send message to discord')
        }

        return res.status(200).json({ success: true })
      } catch (err: any) {
        console.log(err)
        // Remove transaction from used set if notification failed, allowing retry
        usedTransactions.delete(txHash)
        return res.status(400).json({
          message: err.message,
        })
      }
    } catch (err: any) {
      console.log(err)
      return res.status(400).json({
        error: 'Failed to send contribution notification',
      })
    }
  } else {
    res.status(405).send({ message: 'Method not allowed' })
  }
}
export default withMiddleware(handler, authMiddleware)
