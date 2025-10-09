import VotesTableABI from 'const/abis/Votes.json'
import {
  DEFAULT_CHAIN_V5,
  VOTES_TABLE_ADDRESSES,
  WBA_VOTE_ID,
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
import { computeRewardPercentages } from '@/lib/utils/rewards'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import { PrivyWeb3Button } from '@/components/privy/PrivyWeb3Button'
import { Finalist } from '@/components/wba/Finalist'
import FinalistCard from '@/components/wba/FinalistCard'
import DistributionVotes from '../tableland/DistributionVotes'

export type WBAProps = {
  finalists: Finalist[]
  distributions: DistributionVote[]
  refresh: () => void
}

export function WBA({ finalists, distributions, refresh }: WBAProps) {
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

  const percentages = [13.9, 7.7, 12.9, 10.6, 9.6, 8.3, 6, 10.5, 7.9, 12.5]
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
          params: [WBA_VOTE_ID, JSON.stringify(distribution)],
        })
        receipt = await sendAndConfirmTransaction({
          transaction,
          account,
        })
      } else {
        const transaction = prepareContractCall({
          contract: distributionTableContract,
          method: 'insertIntoTable' as string,
          params: [WBA_VOTE_ID, JSON.stringify(distribution)],
        })
        receipt = await sendAndConfirmTransaction({
          transaction,
          account,
        })
      }
      if (receipt) setTimeout(() => router.push('/wba/thank-you'), 5000)
    } catch (error) {
      console.error('Error submitting distribution:', error)
      toast.error('Error submitting distribution. Please try again.', {
        style: toastStyle,
      })
    }
  }
  return (
    <section id="projects-container" className="overflow-hidden">
      <Head
        title="WBA"
        description="View World’s Biggest Analog Scholarship finalists and vote for the candidate or candidates you believe should receive the top scholarships."
      />
      <Container>
        <ContentLayout
          header={'WBA Finalists'}
          description={
            'View World’s Biggest Analog Scholarship finalists and vote for the candidate or candidates you believe should receive the top scholarships. Distribute your voting power (square root of vMOONEY balance) as a percentage between the candidates. You can vote for multiple people. Votes are due by Monday, September 8th at midnight EST.'
          }
          headerSize="max(20px, 3vw)"
          preFooter={<NoticeFooter />}
          mainPadding
          mode="compact"
          popOverEffect={false}
          isProfile
        >
          <div
            className={`flex flex-col gap-6 px:40 md:p-8 bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl max-w-[1200px] ${
              !isMobile && 'p-6'
            }`}
          >
            <div className="mt-6 w-full flex flex-col lg:flex-row justify-between">
              <div className="w-full">
                {finalists && finalists.length > 0 ? (
                  finalists.map((finalist: any, i) => (
                    <div
                      key={`finalist-card-${i}`}
                      className="m-2 bg-black/20 rounded-xl border border-white/10 overflow-hidden max-w-[600px]"
                    >
                      <FinalistCard
                        key={`finalist-card-${i}`}
                        finalist={finalist}
                        distribution={
                          userHasVotingPower ? distribution : undefined
                        }
                        handleDistributionChange={
                          userHasVotingPower
                            ? handleDistributionChange
                            : undefined
                        }
                        userHasVotingPower={userHasVotingPower}
                        isVotingPeriod={isVotingPeriod}
                        percentage={percentages[finalist.id]}
                      />
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <p>There are no finalists.</p>
                  </div>
                )}
              </div>

              <div className="mt-2 w-full flex justify-end">
                <DistributionVotes
                  title="WBA Votes"
                  votes={distributions}
                  finalists={finalists}
                />
              </div>

              {isVotingPeriod && finalists && finalists.length > 0 && (
                <div className="mt-6 w-full flex justify-end">
                  {userHasVotingPower ? (
                    <span className="flex flex-col md:flex-row md:items-center gap-2">
                      <PrivyWeb3Button
                        action={handleSubmit}
                        requiredChain={chain}
                        className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-RobotoMono rounded-xl transition-all duration-300 transform hover:scale-[1.02] shadow-lg hover:shadow-xl border-0"
                        label={
                          edit ? 'Edit Distribution' : 'Submit Distribution'
                        }
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
        </ContentLayout>
      </Container>
    </section>
  )
}
