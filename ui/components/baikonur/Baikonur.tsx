import VotesTableABI from 'const/abis/Votes.json'
import {
  DEFAULT_CHAIN_V5,
  VOTES_TABLE_ADDRESSES,
  BAIKONUR_VOTE_ID,
} from 'const/config'
import _ from 'lodash'
import { useRouter } from 'next/router'
import { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import { prepareContractCall, sendAndConfirmTransaction } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import { DistributionVote } from '@/lib/tableland/types'
import useWindowSize from '@/lib/team/use-window-size'
import { getChainSlug } from '@/lib/thirdweb/chain'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { useTotalVP, useTotalVPs } from '@/lib/tokens/hooks/useTotalVP'
import { runQuadraticVoting } from '@/lib/utils/rewards'
import { Finalist } from '@/components/baikonur/Finalist'
import FinalistCard from '@/components/baikonur/FinalistCard'
import { PrivyWeb3Button } from '@/components/privy/PrivyWeb3Button'

export type BaikonurProps = {
  finalists: Finalist[]
  distributions: DistributionVote[]
  refresh: () => void
}

export function Baikonur({ finalists, distributions, refresh }: BaikonurProps) {
  const router = useRouter()

  const chain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(chain)
  const account = useActiveAccount()
  const { isMobile } = useWindowSize()
  const userAddress = account?.address

  const isVotingPeriod = false

  const [edit, setEdit] = useState(false)
  const [distribution, setDistribution] = useState<{ [key: string]: number }>(
    {}
  )

  // Check if the user already has a distribution
  useEffect(() => {
    if (distributions && userAddress) {
      for (const d of distributions) {
        if (d.address.toLowerCase() === userAddress.toLowerCase()) {
          setDistribution(d.vote)
          setEdit(true)
          break
        }
      }
    }
  }, [userAddress, distributions])

  const handleDistributionChange = (projectId: string, value: number) => {
    const newValue = Math.min(100, Math.max(0, +value))
    setDistribution((prev) => ({
      ...prev,
      [projectId]: newValue,
    }))
  }

  //Contracts
  const distributionTableContract = useContract({
    address: VOTES_TABLE_ADDRESSES[chainSlug],
    chain: chain,
    abi: VotesTableABI.abi as any,
  })
  const addresses = useMemo(() => {
    return distributions ? distributions.map((d) => d.address) : []
  }, [distributions])

  const { walletVPs: _vps } = useTotalVPs(addresses)
  const addressToQuadraticVotingPower = Object.fromEntries(
    addresses.map((address, index) => [address, _vps[index]])
  )
  const votingPowerSumIsNonZero =
    _.sum(Object.values(addressToQuadraticVotingPower)) > 0
  const userVotingPower = useTotalVP(userAddress || '')
  const userHasVotingPower = useMemo(() => {
    return userAddress && userVotingPower.walletVP > 0
  }, [userVotingPower, userAddress])

  // Map from address to percentage of commnity rewards
  const readyToRunVoting = distributions.length > 0
  if (readyToRunVoting) {
    const SUM_TO_ONE_HUNDRED = 100
    const outcome = runQuadraticVoting(
      distributions,
      addressToQuadraticVotingPower,
      SUM_TO_ONE_HUNDRED
    )
    console.log(
      finalists
        .map((finalist) => {
          return `${finalist.name}: ${
            Math.round(outcome[finalist.id] * 10) / 10
          }%`
        })
        .join(', ')
    )
  }

  const handleSubmit = async () => {
    const totalPercentage = Object.values(distribution).reduce(
      (sum, value) => sum + value,
      0
    )
    if (totalPercentage !== 100) {
      toast.error('Total distribution must equal 100%.', {
        style: toastStyle,
      })
      return
    }
    try {
      if (!account) throw new Error('No account found')
      let receipt
      if (edit) {
        const transaction = prepareContractCall({
          contract: distributionTableContract,
          method: 'updateTableCol' as string,
          params: [BAIKONUR_VOTE_ID, JSON.stringify(distribution)],
        })
        receipt = await sendAndConfirmTransaction({
          transaction,
          account,
        })
      } else {
        const transaction = prepareContractCall({
          contract: distributionTableContract,
          method: 'insertIntoTable' as string,
          params: [BAIKONUR_VOTE_ID, JSON.stringify(distribution)],
        })
        receipt = await sendAndConfirmTransaction({
          transaction,
          account,
        })
      }
      if (receipt) setTimeout(() => router.push('/artrocket/thank-you'), 5000)
    } catch (error) {
      console.error('Error submitting distribution:', error)
      toast.error('Error submitting distribution. Please try again.', {
        style: toastStyle,
      })
    }
  }
  return (
    <div
      className={`w-full flex flex-col gap-6 px:40 md:p-8 bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl max-w-[1200px] ${
        !isMobile && 'p-6'
      }`}
    >
      <div>
        {finalists && finalists.length > 0 ? (
          finalists.map((finalist: any, i) => (
            <div
              key={`finalist-card-${i}`}
              className="m-2 bg-black/20 rounded-xl border border-white/10 overflow-hidden"
            >
              <FinalistCard
                key={`finalist-card-${i}`}
                finalist={finalist}
                distribution={userHasVotingPower ? distribution : undefined}
                handleDistributionChange={
                  userHasVotingPower ? handleDistributionChange : undefined
                }
                userHasVotingPower={userHasVotingPower}
                isVotingPeriod={isVotingPeriod}
                percentage={0}
              />
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-gray-400">
            <p>There are no finalists.</p>
          </div>
        )}

        {isVotingPeriod && finalists && finalists.length > 0 && (
          <div className="mt-6 w-full flex justify-end">
            {userHasVotingPower ? (
              <span className="flex flex-col md:flex-row md:items-center gap-2">
                <PrivyWeb3Button
                  action={handleSubmit}
                  requiredChain={chain}
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-RobotoMono rounded-xl transition-all duration-300 transform hover:scale-[1.02] shadow-lg hover:shadow-xl border-0"
                  label={edit ? 'Edit Distribution' : 'Submit Distribution'}
                />
              </span>
            ) : (
              <span>
                <PrivyWeb3Button
                  v5
                  requiredChain={DEFAULT_CHAIN_V5}
                  label="Get Voting Power"
                  action={() => router.push('/lock')}
                  className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-RobotoMono rounded-xl transition-all duration-300 transform hover:scale-[1.02] shadow-lg hover:shadow-xl border-0"
                />
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
