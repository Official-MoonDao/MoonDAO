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
  MISSION_TABLE_NAMES,
  TEST_CHANNEL_ID,
} from 'const/config'
import { DEPLOYED_ORIGIN } from 'const/config'
import { BigNumber, ethers } from 'ethers'
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
import {
  sendContributionThankYouEmail,
  subscribeContributorToNewsletter,
} from '@/lib/contribution/contributionFollowUp'
import { isValidContributorEmail } from '@/lib/contribution/validateContributorEmail'
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
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const data =
      typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    if (!data) {
      return res.status(400).json({ message: 'Bad request' })
    }

    const { txHash, accessToken, txChainSlug, projectId, contributorEmail, newsletterOptIn } =
      data

    if (!txHash || !accessToken || !txChainSlug) {
      return res.status(400).json({ message: 'Missing required fields' })
    }

    const txChain = v4SlugToV5Chain(txChainSlug)
    if (!txChain) {
      return res.status(400).json({ message: 'Invalid transaction chain' })
    }

    // Verify the Privy access token
    const privyUserData = await getPrivyUserData(accessToken)
    if (!privyUserData) {
      return res.status(400).json({ message: 'Invalid access token' })
    }

    const { walletAddresses } = privyUserData
    if (walletAddresses.length === 0) {
      return res.status(400).json({ message: 'No wallet addresses found' })
    }

    // Check if transaction has already been used
    if (usedTransactions.has(txHash)) {
      return res.status(400).json({
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
      return res.status(400).json({ message: 'Transaction not found' })
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
      return res.status(400).json({
        message: `Transaction is too old`,
      })
    }

    // Mark transaction as used to prevent replay attacks
    usedTransactions.add(txHash)

    // Find the Pay event emitted by the JBV5 terminal to verify and extract contribution details.
    // This works for both same-chain and cross-chain (LayerZero) contributions,
    // where txReceipt.to may be a LayerZero endpoint rather than the terminal itself.
    const PAY_EVENT_SIGNATURE =
      '0x133161f1c9161488f777ab9a26aae91d47c0d9a3fafb398960f138db02c73797'
    const payLog = txReceipt.logs.find(
      (log: any) =>
        log.topics[0] === PAY_EVENT_SIGNATURE &&
        log.address?.toLowerCase() === JBV5_TERMINAL_ADDRESS.toLowerCase()
    )

    if (!payLog) {
      return res.status(400).json({
        message: 'No Pay event found from JBV5 terminal in transaction',
      })
    }

    const payEventInterface = new ethers.utils.Interface([
      'event Pay(uint256 indexed rulesetId, uint256 indexed rulesetCycleNumber, uint256 indexed projectId, address payer, address beneficiary, uint256 amount, uint256 newlyIssuedTokenCount, string memo, bytes metadata, address caller)',
    ])
    const decodedPay = payEventInterface.decodeEventLog(
      'Pay',
      payLog.data,
      payLog.topics
    )

    const verifiedProjectId = BigNumber.from(payLog.topics[3]).toNumber()
    const txValue = BigNumber.from(decodedPay.amount)
    const contributorAddress: string = decodedPay.beneficiary.toLowerCase()

    if (txValue.isZero()) {
      return res.status(400).json({ message: 'Pay event amount is zero' })
    }

    let citizen: any = null
    try {
      const citizenRows: any = await queryTable(
        txChain,
        `SELECT name, id, image, owner FROM ${
          CITIZEN_TABLE_NAMES[chainSlug]
        } WHERE owner = '${contributorAddress}'`
      )

      if (citizenRows.length > 0) {
        citizen = citizenRows[0]
      }
    } catch (err: any) {
      console.error('Failed to fetch citizen data:', err.message)
    }

    //Contribution amount in ETH and USD
    const ethPrice = await getETHPrice()
    if (!ethPrice) {
      return res.status(400).json({ message: 'Failed to get ETH price' })
    }
    const contributionAmountETH = parseFloat(txValue.toString()) / 1e18
    const contributionAmountUSD = contributionAmountETH * ethPrice

    //Mission table data
    const missionRows: any = await queryTable(
      txChain,
      `SELECT id, fundingGoal FROM ${MISSION_TABLE_NAMES[chainSlug]} WHERE projectId = ${verifiedProjectId}`
    )

    if (missionRows.length === 0) {
      return res.status(400).json({ message: 'Mission not found in mission table' })
    }
    const mission = missionRows[0]

    const missionFundingGoal =
      parseFloat(mission.fundingGoal.toString()) / 1e18

    //Mission total raised
    let missionTotalRaised = 0
    let missionTotalRaisedUSD = 0
    let percentOfGoalRaised = 0
    try {
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

      missionTotalRaised =
        (parseFloat(missionBalance.toString()) / 1e18 || 0) +
        (parseFloat(missionUsedPayoutLimit.toString()) / 1e18 || 0)
      missionTotalRaisedUSD = missionTotalRaised * ethPrice
      percentOfGoalRaised =
        (missionTotalRaised / missionFundingGoal) * 100
    } catch (err: any) {
      console.error('Failed to fetch mission balance:', err.message)
    }

    //Mission metadata
    let missionMetadata: any = { name: `Mission #${mission.id}` }
    try {
      const missionMetadataURI = await readContract({
        contract: jbControllerContract,
        method: 'uriOf' as string,
        params: [verifiedProjectId],
      })
      const missionMetadataRes = await fetch(
        `${IPFS_GATEWAY}${String(missionMetadataURI).replace('ipfs://', '')}`
      )
      missionMetadata = await missionMetadataRes.json()
    } catch (err: any) {
      console.error('Failed to fetch mission metadata:', err.message)
    }

    //Mission deadline
    let missionDeadline = null
    try {
      const payHookAddress: any = await readContract({
        contract: missionCreatorContract,
        method: 'missionIdToPayHook' as string,
        params: [mission.id],
      })

      if (
        payHookAddress &&
        payHookAddress !== '0x0000000000000000000000000000000000000000'
      ) {
        const payHookContract = getContract({
          client: serverClient,
          address: payHookAddress,
          chain: DEFAULT_CHAIN_V5,
          abi: PayHookABI.abi as any,
        })
        missionDeadline = await readContract({
          contract: payHookContract,
          method: 'deadline' as string,
          params: [],
        })
      }
    } catch (err: any) {
      console.error('Failed to fetch mission deadline:', err.message)
    }

    //Send discord notification
    const messageData: any = {
      embeds: [
        {
          description: `## **${
            citizen?.name
              ? `[${
                  citizen.name
                }](${DEPLOYED_ORIGIN}/citizen/${generatePrettyLinkWithId(
                  citizen.name,
                  citizen.id
                )})`
              : contributorAddress.slice(0, 6) +
                '...' +
                contributorAddress.slice(-4)
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
          }`,
        },
      ],
    }

    if (citizen?.image) {
      messageData.embeds[0].image = {
        url: `${IPFS_GATEWAY}${citizen.image.replace('ipfs://', '')}`,
      }
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
      usedTransactions.delete(txHash)
      throw new Error('Failed to send message to Discord')
    }

    const emailTrim =
      typeof contributorEmail === 'string' ? contributorEmail.trim() : ''
    const wantsNewsletter = newsletterOptIn === true

    if (isValidContributorEmail(emailTrim)) {
      // Fire-and-forget: don't block the response on follow-up delivery.
      sendContributionThankYouEmail(emailTrim).catch((err: any) => {
        console.error(
          'Contribution thank-you email failed:',
          err?.message || err
        )
      })
      if (wantsNewsletter) {
        subscribeContributorToNewsletter(emailTrim).catch((err: any) => {
          console.error(
            'Contribution newsletter subscribe failed:',
            err?.message || err
          )
        })
      }
    }

    return res.status(200).json({ success: true })
  } catch (err: any) {
    console.error('Contribution notification error:', err)
    return res.status(400).json({
      message: err.message || 'Failed to send contribution notification',
    })
  }
}
export default withMiddleware(handler, authMiddleware)
