import useContract from '@/lib/thirdweb/hooks/useContract'
import BigNumber from 'bignumber.js'
import { readContract } from 'thirdweb'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ConditionalTokens from 'const/abis/ConditionalTokens.json'
import { useActiveAccount } from 'thirdweb/react'
import { prepareContractCall, sendAndConfirmTransaction } from 'thirdweb'
import LMSR from 'const/abis/LMSR.json'
import LMSRWithTWAP from 'const/abis/LMSRWithTWAP.json'
import WETH from 'const/abis/WETH.json'
import {
  LMSR_WITH_TWAP_ADDRESSES,
  CONDITIONAL_TOKEN_ADDRESSES,
  COLLATERAL_TOKEN_ADDRESSES,
  ORACLE_ADDRESS,
  COLLATERAL_DECIMALS,
  MAX_OUTCOMES,
  DEFAULT_CHAIN_V5,
} from 'const/config'
import { ethers } from 'ethers'
import React, { useState, useEffect } from 'react'
//import loadConditionalTokensRepo from 'src/logic/ConditionalTokens'
import loadMarketMakersRepo from 'src/logic/MarketMakers'
import Layout from './Layout'

BigNumber.config({ EXPONENTIAL_AT: 50 })

const markets = require('const/betting/config.sepolia.json')

type Competitor = {
  id: string
  deprize: number
  teamId: number
  metadata: Metadata
}
type MarketProps = {
  userAddress: string
  competitors: Competitor[]
  teamContract: any
}

enum MarketStage {
  Running = 0,
  Paused = 1,
  Closed = 2,
}

const getConditionId = (
  oracleAddress: string,
  questionId: string,
  outcomeSlotCount: number
) => {
  return ethers.utils.solidityKeccak256(
    ['address', 'bytes32', 'uint256'],
    [oracleAddress, questionId, outcomeSlotCount]
  )
}

const getPositionId = (collateralToken: string, collectionId: string) => {
  return ethers.utils.solidityKeccak256(
    ['address', 'bytes32'],
    [collateralToken, collectionId]
  )
}

//let conditionalTokensRepo: any
let marketMakersRepo: any

const Market: React.FC<MarketProps> = ({
  userAddress,
  competitors,
  teamContract,
}) => {
  const [isConditionLoaded, setIsConditionLoaded] = useState<boolean>(false)
  const [selectedAmount, setSelectedAmount] = useState<string>('')
  const [selectedOutcomeToken, setSelectedOutcomeToken] = useState<number>(0)
  const [marketInfo, setMarketInfo] = useState<any>(undefined)
  const chain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(DEFAULT_CHAIN_V5)
  const account = useActiveAccount()
  const marketMakersRepo = useContract({
    address: LMSR_WITH_TWAP_ADDRESSES[chainSlug],
    chain: chain,
    abi: LMSRWithTWAP.abi,
  })
  const conditionalTokensRepo = useContract({
    address: CONDITIONAL_TOKEN_ADDRESSES[chainSlug],
    chain: chain,
    abi: ConditionalTokens,
  })
  const collateralContract = useContract({
    address: COLLATERAL_TOKEN_ADDRESSES[chainSlug],
    chain: chain,
    abi: WETH,
  })

  useEffect(() => {
    const init = async () => {
      try {
        await getMarketInfo()
        setIsConditionLoaded(true)
      } catch (err) {
        setIsConditionLoaded(false)
        console.error(err)
      }
    }

    init()
  }, [conditionalTokensRepo, marketMakersRepo])

  const getMarketInfo = async () => {
    if (!ORACLE_ADDRESS) return

    const conditionId = getConditionId(
      ORACLE_ADDRESS,
      markets.markets[0].questionId,
      MAX_OUTCOMES
    )

    const outcomes = []
    for (
      let outcomeIndex = 0;
      outcomeIndex < MAX_OUTCOMES;
      outcomeIndex++
    ) {
      const indexSet = (
        outcomeIndex === 0
          ? 1
          : parseInt(Math.pow(10, outcomeIndex).toString(), 2)
      ).toString()

      const collectionId: any = await readContract({
        contract: conditionalTokensRepo,
        method: 'getCollectionId' as string,
        params: [`0x${'0'.repeat(64)}`, conditionId, indexSet],
      })
      const positionId = getPositionId(
        COLLATERAL_TOKEN_ADDRESSES[chainSlug],
        collectionId
      )

      const balance = await readContract({
        contract: conditionalTokensRepo,
        method: 'balanceOf' as string,
        params: [userAddress,positionId],
      })
      const probability = await readContract({
        contract: marketMakersRepo,
        method: 'calcMarginalPrice' as string,
        params: [outcomeIndex],
      })

      const outcome = {
        index: outcomeIndex,
        title: 'Outcome ' + (outcomeIndex + 1),
        probability: ((Number(probability) / 2 ** 64) * 100).toFixed(1),
        balance: Number(balance) / Math.pow(10, COLLATERAL_DECIMALS),
        teamId:
          outcomeIndex > competitors.length - 1
            ? -1
            : competitors[outcomeIndex].teamId,
      }
      outcomes.push(outcome)
    }

    const marketData = {
      lmsrAddress: LMSR_WITH_TWAP_ADDRESSES[chainSlug],
      title: markets.markets[0].title,
      outcomes,
      stage:
        MarketStage[
          await readContract({ contract: marketMakersRepo, method: 'stage' })
        ],
      questionId: markets.markets[0].questionId,
      conditionId: conditionId,
      //payoutDenominator: payoutDenominator,
    }

    setMarketInfo(marketData)
  }

  const buy = async (selectedIndex: number) => {
    const formatedAmount = new BigNumber(selectedAmount).multipliedBy(
      new BigNumber(Math.pow(10, COLLATERAL_DECIMALS))
    )

    const outcomeTokenAmounts = Array.from(
      { length: MAX_OUTCOMES },
      (value: any, index: number) =>
        (index === selectedIndex ? formatedAmount : new BigNumber(0)).toString()
    )

    const cost = await readContract({
      contract: marketMakersRepo,
      method: 'calcNetCost' as string,
      params: [outcomeTokenAmounts],
    })

    const collateralBalance = await readContract({
      contract: collateralContract,
      method: 'balanceOf' as string,
      params: [userAddress],
    })
    if (cost.gt(collateralBalance)) {
      const depositTransaction = prepareContractCall({
        contract: collateralContract,
        method: 'deposit',
        value: formatedAmount.toString(),
      })
      await sendAndConfirmTransaction({
        transaction: depositTransaction,
        account,
      })
      const approveTransaction = prepareContractCall({
        contract: collateralContract,
        method: 'approve',
        params: [marketInfo.lmsrAddress, formatedAmount.toString()],
      })
      await sendAndConfirmTransaction({
        approveTransaction,
        account,
      })
    }

    const tradeTransaction = prepareContractCall({
      contract: marketMakersRepo,
      method: 'trade',
      params: [outcomeTokenAmounts, cost],
    })
    await sendAndConfirmTransaction({
      transaction: tradeTransaction,
      account,
    })

    await getMarketInfo()
  }

  const sell = async (selectedIndex: number) => {
    const formatedAmount = new BigNumber(selectedAmount).multipliedBy(
      new BigNumber(Math.pow(10, COLLATERAL_DECIMALS))
    )

    const isApproved = await readContract({
      contract: conditionalTokensRepo,
      method: 'isApprovedForAll' as string,
      params: [userAddress, marketInfo.lmsrAddress],
    })
    if (!isApproved) {
      const approveTransaction = prepareContractCall({
        contract: conditionalTokensRepo,
        method: 'setApprovalForAll',
        params: [marketInfo.lmsrAddress, true],
      })
      await sendAndConfirmTransaction({
        approveTransaction,
        account,
      })
    }

    const outcomeTokenAmounts = Array.from({ length: MAX_OUTCOMES }, (v, i) =>
      (i === selectedIndex
        ? formatedAmount.multipliedBy(new BigNumber(-1))
        : new BigNumber(0)
      ).toString()
    )
    const profit = readContract({
      contract: marketMakersRepo,
      method: 'calcNetCost' as string,
      params: [outcomeTokenAmounts],
    })

    const tradeTransaction = prepareContractCall({
      contract: marketMakersRepo,
      method: 'trade',
      params: [outcomeTokenAmounts, (profit * -1).toString()],
    })
    await sendAndConfirmTransaction({
      transaction: tradeTransaction,
      account,
    })

    await getMarketInfo()
  }

  const redeem = async () => {
    const indexSets = Array.from({ length: MAX_OUTCOMES }, (v, i) =>
      i === 0 ? 1 : parseInt(Math.pow(10, i).toString(), 2)
    )

    const transaction = prepareContractCall({
      contract: conditionalTokensRepo,
      method: 'redeemPositions',
      params: [
        COLLATERAL_TOKEN_ADDRESSES[chainSlug],
        `0x${'0'.repeat(64)}`,
        marketInfo.conditionId,
        indexSets,
        userAddress,
      ],
    })
    await sendAndConfirmTransaction({
      transaction,
      account,
    })


    await getMarketInfo()
  }

  const close = async () => {
    const transaction = prepareContractCall({
      contract: marketMakersRepo,
      method: 'close',
    })
    await sendAndConfirmTransaction({
      transaction,
      account,
    })

    await getMarketInfo()
  }

  const resolve = async (resolutionOutcomeIndex: number) => {
    const payouts = Array.from(
      { length: MAX_OUTCOMES },
      (value: any, index: number) => (index === resolutionOutcomeIndex ? 1 : 0)
    )

    const transaction = prepareContractCall({
      contract: conditionalTokensRepo,
      method: 'reportPayouts',
      params: [marketInfo.questionId, payouts],
    })
    await sendAndConfirmTransaction({
      transaction,
      account,
    })

    await getMarketInfo()
  }

  const isMarketClosed =
    isConditionLoaded &&
    MarketStage[marketInfo.stage].toString() === MarketStage.Closed.toString()
  return (
    <Layout
      userAddress={userAddress}
      isConditionLoaded={isConditionLoaded}
      isMarketClosed={isMarketClosed}
      marketInfo={marketInfo}
      teamContract={teamContract}
      setSelectedAmount={setSelectedAmount}
      selectedAmount={selectedAmount}
      setSelectedOutcomeToken={setSelectedOutcomeToken}
      selectedOutcomeToken={selectedOutcomeToken}
      buy={buy}
      sell={sell}
      redeem={redeem}
      close={close}
      resolve={resolve}
    />
  )
}

export default Market
