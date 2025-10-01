import Image from 'next/image'
import { useActiveAccount } from 'thirdweb/react'
import { useContext } from 'react'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { getChainSlug } from '@/lib/thirdweb/chain'
import useContract from '@/lib/thirdweb/hooks/useContract'
import useWithdrawAmount from '@/lib/utils/hooks/useWithdrawAmount'
import { VOTING_ESCROW_DEPOSITOR_ADDRESSES, MOONEY_DECIMALS } from 'const/config'
import VotingEscrowDepositor from 'const/abis/VotingEscrowDepositor.json'
import WithdrawVMooney from '@/components/tokens/WithdrawVMooney'

export default function ClaimRewardsSection() {
  const account = useActiveAccount()
  const address = account?.address
  
  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)

  const votingEscrowDepositorContract = useContract({
    address: VOTING_ESCROW_DEPOSITOR_ADDRESSES[chainSlug],
    abi: VotingEscrowDepositor.abi,
    chain: selectedChain,
  })

  const withdrawable = useWithdrawAmount(votingEscrowDepositorContract, address)

  // If user has rewards to claim, show a compact version
  if (Number(withdrawable) > 0) {
    return (
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
            <Image
              src="/assets/vmooney-shield.svg"
              alt="vMOONEY"
              width={16}
              height={16}
            />
          </div>
          <div>
            <p className="text-white text-sm font-medium">Retroactive Rewards</p>
            <p className="text-green-400 text-xs">Ready to claim</p>
          </div>
        </div>
        
        <div className="bg-black/20 rounded-lg p-3 border border-white/5 mb-3">
          <div className="text-center">
            <p className="text-green-400 text-lg font-RobotoMono font-bold">
              {(Number(withdrawable) / 10 ** MOONEY_DECIMALS).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
            <p className="text-gray-400 text-xs">vMOONEY tokens</p>
          </div>
        </div>

        <button
          onClick={() => window.open('/lock', '_blank')}
          className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-all duration-200 transform hover:scale-[1.02]"
        >
          Claim Rewards
        </button>
      </div>
    )
  }

  // If no wallet connected, don't show anything
  if (!address) {
    return null
  }

  // Show "check back" message when no rewards available - compact version
  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-full bg-gray-500/20 flex items-center justify-center">
          <Image
            src="/assets/vmooney-shield.svg"
            alt="vMOONEY"
            width={16}
            height={16}
            className="opacity-50"
          />
        </div>
        <div>
          <p className="text-white text-sm font-medium">Retroactive Rewards</p>
          <p className="text-gray-400 text-xs">Check back end of quarter</p>
        </div>
      </div>
      
      <div className="bg-black/20 rounded-lg p-3 border border-white/5 mb-3">
        <div className="text-center">
          <p className="text-gray-400 text-lg font-RobotoMono font-bold">0.00</p>
          <p className="text-gray-500 text-xs">vMOONEY available</p>
        </div>
      </div>

      <div className="w-full bg-gradient-to-r from-gray-500 to-gray-600 text-white py-2 px-4 rounded-lg text-sm font-medium opacity-50 cursor-not-allowed text-center">
        No Rewards
      </div>
    </div>
  )
}