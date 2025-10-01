import { MOONEY_DECIMALS, DEFAULT_CHAIN_V5 } from 'const/config'
import Image from 'next/image'
import useRetroactiveRewards from '@/lib/tokens/hooks/useRetroactiveRewards'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'

export default function ClaimRewardsSection() {
  const { withdrawable, withdraw } = useRetroactiveRewards()

  const hasRewards = Number(withdrawable) > 0
  const formattedAmount = hasRewards
    ? (Number(withdrawable) / 10 ** MOONEY_DECIMALS).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : '0.00'

  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4">
      <div className="flex items-center gap-3 mb-3">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center ${
            hasRewards ? 'bg-green-500/20' : 'bg-gray-500/20'
          }`}
        >
          <Image
            src="/assets/vmooney-shield.svg"
            alt="vMOONEY"
            width={16}
            height={16}
            className={hasRewards ? '' : 'opacity-50'}
          />
        </div>
        <div>
          <p className="text-white text-sm font-medium">Retroactive Rewards</p>
          <p
            className={`text-xs ${
              hasRewards ? 'text-green-400' : 'text-gray-400'
            }`}
          >
            {hasRewards ? 'Ready to claim' : 'Check back end of quarter'}
          </p>
        </div>
      </div>

      <div className="bg-black/20 rounded-lg p-3 border border-white/5 mb-3">
        <div className="text-center">
          <p
            className={`text-lg font-RobotoMono font-bold ${
              hasRewards ? 'text-green-400' : 'text-gray-400'
            }`}
          >
            {formattedAmount}
          </p>
          <p
            className={`text-xs ${
              hasRewards ? 'text-gray-400' : 'text-gray-500'
            }`}
          >
            {hasRewards ? 'vMOONEY tokens' : 'vMOONEY available'}
          </p>
        </div>
      </div>

      {hasRewards ? (
        <PrivyWeb3Button
          label="Claim Rewards"
          action={withdraw}
          className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-all duration-200 transform hover:scale-[1.02]"
          requiredChain={DEFAULT_CHAIN_V5}
        />
      ) : (
        <div className="w-full bg-gradient-to-r from-gray-500 to-gray-600 text-white py-2 px-4 rounded-lg text-sm font-medium opacity-50 cursor-not-allowed text-center">
          No Rewards
        </div>
      )}
    </div>
  )
}
