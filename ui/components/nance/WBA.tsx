import DistributionTableABI from 'const/abis/DistributionTable.json'
import HatsABI from 'const/abis/Hats.json'
import ProjectABI from 'const/abis/Project.json'
import {
  DEFAULT_CHAIN_V5,
  DISTRIBUTION_TABLE_ADDRESSES,
  HATS_ADDRESS,
  PROJECT_ADDRESSES,
  ARBITRUM_ASSETS_URL,
  POLYGON_ASSETS_URL,
  BASE_ASSETS_URL,
} from 'const/config'
import useStakedEth from 'lib/utils/hooks/useStakedEth'
import _ from 'lodash'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import { prepareContractCall, sendAndConfirmTransaction } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import { useCitizens } from '@/lib/citizen/useCitizen'
import { assetImageExtension } from '@/lib/dashboard/dashboard-utils.ts/asset-config'
import { useAssets } from '@/lib/dashboard/hooks'
import { ethereum } from '@/lib/infura/infuraChains'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import { Project } from '@/lib/project/useProjectData'
import { getChainSlug } from '@/lib/thirdweb/chain'
import useContract from '@/lib/thirdweb/hooks/useContract'
import { useTotalVP, useTotalVPs } from '@/lib/tokens/hooks/useTotalVP'
import { useUniswapTokens } from '@/lib/uniswap/hooks/useUniswapTokens'
import { pregenSwapRoute } from '@/lib/uniswap/pregenSwapRoute'
import { computeRewardPercentages } from '@/lib/utils/rewards'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import SectionCard from '@/components/layout/SectionCard'
import StandardButtonRight from '@/components/layout/StandardButtonRight'
import { PrivyWeb3Button } from '@/components/privy/PrivyWeb3Button'
import Finalist from '@/components/wba/Finalist'
import FinalistCard from '@/components/wba/FinalistCard'

export type Distribution = {
  address: string
  distribution: { [key: string]: number }
}

export type WBAProps = {
  finalists: Finalist[]
  distributions: Distribution[]
  refresh: () => void
}

// Helper function to format large numbers for mobile display

export function WBA({ finalists, distributions, refresh }: WBAProps) {
  const router = useRouter()

  const chain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(chain)
  const account = useActiveAccount()
  const userAddress = account?.address

  const active = true

  const [edit, setEdit] = useState(false)
  const [distribution, setDistribution] = useState<{ [key: string]: number }>(
    {}
  )

  // Check if the user already has a distribution
  useEffect(() => {
    if (distributions && userAddress) {
      for (const d of distributions) {
        if (d.address.toLowerCase() === userAddress.toLowerCase()) {
          setDistribution(d.distribution)
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
    address: DISTRIBUTION_TABLE_ADDRESSES[chainSlug],
    chain: chain,
    abi: DistributionTableABI as any,
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
    return userAddress && userVotingPower > 0
  }, [userVotingPower, userAddress])

  const isCitizenAddresses = useCitizens(chain, addresses)
  const citizenVotingAddresses = [
    '0x78176eaabcb3255e898079dc67428e15149cdc99', // payout for ryand2d.eth
    '0x9fdf876a50ea8f95017dcfc7709356887025b5bb', // payout for mitchmcquinn.eth
  ]
  const isCitizenVotingAddresses = addresses.map((address) =>
    citizenVotingAddresses.includes(address.toLowerCase())
  )
  const isCitizens = isCitizenAddresses.map(
    (isCitizen, i) => isCitizen || isCitizenVotingAddresses[i]
  )

  let citizenDistributions = distributions?.filter((_, i) => isCitizens[i])
  const nonCitizenDistributions = distributions?.filter(
    (_, i) => !isCitizens[i]
  )
  // Map from address to percentage of commnity rewards
  const readyToRunVoting = distributions.length > 0

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
          params: [JSON.stringify(distribution)],
        })
        receipt = await sendAndConfirmTransaction({
          transaction,
          account,
        })
      } else {
        const transaction = prepareContractCall({
          contract: distributionTableContract,
          method: 'insertIntoTable' as string,
          params: [JSON.stringify(distribution)],
        })
        receipt = await sendAndConfirmTransaction({
          transaction,
          account,
        })
      }
      if (receipt) setTimeout(() => router.push('/projects/thank-you'), 5000)
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
        title="Projects"
        description="View active projects and allocate retroactive rewards to completed projects and their contributors based on impact and results.'"
      />
      <Container>
        <ContentLayout
          header={'WBA Finalists'}
          description={
            'View World’s Biggest Analog Scholarship finalists and vote for the candidate or candidates you believe should receive the top scholarships.'
          }
          headerSize="max(20px, 3vw)"
          preFooter={<NoticeFooter />}
          mainPadding
          mode="compact"
          popOverEffect={false}
          isProfile
        >
          <div className="flex flex-col gap-6 p-6 md:p-8 bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl max-w-[1200px]">
            {/* Condensed Top Section - Rewards + Create Button */}
            <h1 className="font-GoodTimes text-white/80 text-xl mb-6">
              Finalists
            </h1>

            <div>
              {finalists && finalists.length > 0 ? (
                finalists.map((finalist: any, i) => (
                  <div
                    key={`finalist-card-${i}`}
                    className="bg-black/20 rounded-xl border border-white/10 overflow-hidden"
                  >
                    <FinalistCard
                      key={`finalist-card-${i}`}
                      finalist={finalist}
                      distribute={active}
                      distribution={
                        userHasVotingPower ? distribution : undefined
                      }
                      handleDistributionChange={
                        userHasVotingPower
                          ? handleDistributionChange
                          : undefined
                      }
                      userHasVotingPower={userHasVotingPower}
                      isVotingPeriod={active}
                    />
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <p>There are no finalists.</p>
                </div>
              )}

              {active && finalists && finalists.length > 0 && (
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
