import { Arbitrum, Sepolia, ArbitrumSepolia } from '@thirdweb-dev/chains'
import { useContract } from '@thirdweb-dev/react'
import BigNumber from 'bignumber.js'
import ConditionalTokens from 'const/abis/ConditionalTokens.json'
import LMSR from 'const/abis/LMSR.json'
import WETH from 'const/abis/WETH.json'
import {
  LMSR_ADDRESSES,
  CONDITIONAL_TOKEN_ADDRESSES,
  COLLATERAL_TOKEN_ADDRESSES,
  ORACLE_ADDRESS,
  COLLATERAL_DECIMALS,
  MAX_OUTCOMES,
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
  account: string
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
//let marketMakersRepo: any

const Market: React.FC<MarketProps> = ({
  account,
  competitors,
  teamContract,
}) => {
  const [isConditionLoaded, setIsConditionLoaded] = useState<boolean>(false)
  const [selectedAmount, setSelectedAmount] = useState<string>('')
  const [selectedOutcomeToken, setSelectedOutcomeToken] = useState<number>(0)
  const [marketInfo, setMarketInfo] = useState<any>(undefined)
  const chain = process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Arbitrum : Sepolia
  const { contract: marketMakersRepo } = useContract(
    LMSR_ADDRESSES[chain.slug],
    LMSR.abi
  )
  const { contract: conditionalTokensRepo } = useContract(
    CONDITIONAL_TOKEN_ADDRESSES[chain.slug],
    ConditionalTokens.abi
  )
  const { contract: collateralContract } = useContract(
    COLLATERAL_TOKEN_ADDRESSES[chain.slug],
    WETH.abi
  )

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

    const collateral = await marketMakersRepo.call('collateralToken')
    const pmSystem = await marketMakersRepo.call('pmSystem')

    const conditionId = getConditionId(
      ORACLE_ADDRESS,
      markets.markets[0].questionId,
      //markets.markets[0].outcomes.length
      MAX_OUTCOMES
    )

    const outcomes = []
    for (
      let outcomeIndex = 0;
      outcomeIndex < competitors.length;
      outcomeIndex++
    ) {
      const indexSet = (
        outcomeIndex === 0
          ? 1
          : parseInt(Math.pow(10, outcomeIndex).toString(), 2)
      ).toString()
      const collectionId = await conditionalTokensRepo.call('getCollectionId', [
        `0x${'0'.repeat(64)}`,
        conditionId,
        indexSet,
      ])
      const positionId = getPositionId(
        COLLATERAL_TOKEN_ADDRESSES[chain.slug],
        collectionId
      )
      const balance = await conditionalTokensRepo.call('balanceOf', [
        account,
        positionId,
      ])
      const probability = await marketMakersRepo.call('calcMarginalPrice', [
        outcomeIndex,
      ])
        console.log('competitor.length', competitors.length)
        console.log(competitors[outcomeIndex])

      const outcome = {
        index: outcomeIndex,
        title: 'Outcome ' + (outcomeIndex + 1),
        probability: ((probability / 2 ** 64) * 100).toFixed(2),
        balance: balance / Math.pow(10, COLLATERAL_DECIMALS),
        teamId: competitors[outcomeIndex].teamId,
        //payoutNumerator: payoutNumerator,
      }
      outcomes.push(outcome)
    }

    const marketData = {
      lmsrAddress: LMSR_ADDRESSES[chain.slug],
      title: markets.markets[0].title,
      outcomes,
      stage: MarketStage[await marketMakersRepo.call('stage')],
      questionId: markets.markets[0].questionId,
      conditionId: conditionId,
      //payoutDenominator: payoutDenominator,
    }

    setMarketInfo(marketData)
  }

  const buy = async () => {
    const formatedAmount = new BigNumber(selectedAmount).multipliedBy(
      new BigNumber(Math.pow(10, COLLATERAL_DECIMALS))
    )

    const outcomeTokenAmounts = Array.from(
      { length: marketInfo.outcomes.length },
      (value: any, index: number) =>
        (index === selectedOutcomeToken
          ? formatedAmount
          : new BigNumber(0)
        ).toString()
    )

    const cost = await marketMakersRepo.call('calcNetCost', [
      outcomeTokenAmounts,
    ])

    const collateralBalance = await collateralContract.call('balanceOf', [
      account,
    ])
    if (cost.gt(collateralBalance)) {
      await collateralContract.call('deposit', [], {
        value: formatedAmount.toString(),
      })
      await collateralContract.call(
        'approve',
        [marketInfo.lmsrAddress, formatedAmount.toString()],
        {
          from: account,
        }
      )
    }

    const tx = await marketMakersRepo.call('trade', [outcomeTokenAmounts, cost])
    console.log({ tx })

    await getMarketInfo()
  }

  const sell = async () => {
    const formatedAmount = new BigNumber(selectedAmount).multipliedBy(
      new BigNumber(Math.pow(10, COLLATERAL_DECIMALS))
    )

    const isApproved = await conditionalTokensRepo.call('isApprovedForAll', [
      account,
      marketInfo.lmsrAddress,
    ])
    if (!isApproved) {
      await conditionalTokensRepo.call('setApprovalForAll', [
        marketInfo.lmsrAddress,
        true,
        account,
      ])
    }

    const outcomeTokenAmounts = Array.from(
      { length: marketInfo.outcomes.length },
      (v, i) =>
        i === selectedOutcomeToken ? formatedAmount.negated() : new BigNumber(0)
    )
    const profit = (
      await marketMakersRepo.call('calcNetCost', [outcomeTokenAmounts])
    ).neg()

    const tx = await marketMakersRepo.call('trade', [
      outcomeTokenAmounts,
      profit,
      account,
    ])
    console.log({ tx })

    await getMarketInfo()
  }

  const redeem = async () => {
    const indexSets = Array.from(
      { length: marketInfo.outcomes.length },
      (v, i) => (i === 0 ? 1 : parseInt(Math.pow(10, i).toString(), 2))
    )

    const tx = await conditionalTokensRepo.call('redeemPositions', [
      COLLATERAL_TOKEN_ADDRESSES[chain.slug],
      `0x${'0'.repeat(64)}`,
      marketInfo.conditionId,
      indexSets,
      account,
    ])
    console.log({ tx })

    await getMarketInfo()
  }

  const close = async () => {
    const tx = await marketMakersRepo.call('close')
    console.log({ tx })

    await getMarketInfo()
  }

  const resolve = async (resolutionOutcomeIndex: number) => {
    const payouts = Array.from(
      { length: marketInfo.outcomes.length },
      (value: any, index: number) => (index === resolutionOutcomeIndex ? 1 : 0)
    )
    console.log(
      'outcomeSlotCount',
      await conditionalTokensRepo.call('getOutcomeSlotCount')
    )

    const tx = await conditionalTokensRepo.call('reportPayouts', [
      marketInfo.questionId,
      payouts,
    ])
    console.log({ tx })

    await getMarketInfo()
  }

  const isMarketClosed =
    isConditionLoaded &&
    MarketStage[marketInfo.stage].toString() === MarketStage.Closed.toString()
  return (
    <Layout
      account={account}
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
