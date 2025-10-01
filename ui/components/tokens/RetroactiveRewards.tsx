import { DEFAULT_CHAIN_V5, MOONEY_DECIMALS } from 'const/config'
import Image from 'next/image'
import { useRouter } from 'next/router'
import React from 'react'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import useRetroactiveRewards from '@/lib/tokens/hooks/useRetroactiveRewards'
import { PrivyWeb3Button } from '@/components/privy/PrivyWeb3Button'

export default function RetroactiveRewards() {
  useChainDefault()
  const router = useRouter()
  const chain = DEFAULT_CHAIN_V5

  const { withdrawable, withdraw } = useRetroactiveRewards()

  const handleWithdraw = async () => {
    await withdraw()
    setTimeout(() => {
      router.reload()
    }, 5000)
  }

  if (Number(withdrawable) <= 0) {
    return null
  }

  return (
    <div className="mb-6">
      <div className="bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl overflow-hidden">
        <div className="p-5">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Rewards Amount Section */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Image
                    src="/assets/vmooney-shield.svg"
                    alt="vMOONEY"
                    width={20}
                    height={20}
                  />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Unclaimed Rewards</p>
                  <p className="text-white text-lg font-medium">
                    vMOONEY Available
                  </p>
                </div>
              </div>

              <div className="bg-black/20 rounded-xl p-4 border border-white/5 mb-4">
                <div className="text-center">
                  <p className="text-green-400 text-3xl font-RobotoMono font-bold mb-2">
                    {(
                      Number(withdrawable) /
                      10 ** MOONEY_DECIMALS
                    ).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                  <p className="text-gray-400 text-sm">vMOONEY Tokens</p>
                </div>
              </div>

              <PrivyWeb3Button
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white py-3 px-6 rounded-xl text-base font-semibold transition-all duration-200 transform hover:scale-[1.01] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                action={handleWithdraw}
                isDisabled={Number(withdrawable) === 0}
                requiredChain={chain}
                label="Withdraw Rewards"
              />
            </div>

            {/* Information Section */}
            <div className="flex-1 bg-black/10 rounded-xl p-4 border border-white/5">
              <h3 className="text-lg font-bold text-white mb-3">
                💰 Claim Your Rewards!
              </h3>
              <div className="space-y-3 text-sm text-gray-300">
                <p>
                  Click 'Withdraw Rewards' to claim your vMOONEY rewards and
                  increase your voting impact!
                </p>
                <p>
                  You'll be prompted to create or increase the duration of your
                  lock to 4 years. Expect to sign 2-4 transactions.
                </p>
                <p className="text-blue-400">
                  💡 Increase your stake amount or duration at any time for
                  greater impact!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
