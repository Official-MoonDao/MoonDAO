import { COIN_ICONS } from 'const/icons'
import Image from 'next/image'
import { useState } from 'react'
import { useActiveAccount } from 'thirdweb/react'
import { useSafeBalances } from '@/lib/nance/SafeHooks'
import { formatUnits } from 'ethers/lib/utils'
import StandardButton from '../layout/StandardButton'
import SafeModal from '../safe/SafeModal'
import SafeTransactions from '../safe/SafeTransactions'

type TeamTreasuryProps = {
  isSigner: boolean
  safeData: any
  multisigAddress: string
}

function TreasuryAsset({ label, balance }: { label: string; balance: string }) {
  return (
    <div className="flex gap-4 items-center text-lg justify-between">
      <Image
        src={COIN_ICONS[label as keyof typeof COIN_ICONS] || '/coins/ETH.svg'}
        alt={label}
        width={20}
        height={20}
      />
      <div className="flex gap-2">
        <p className="font-GoodTimes">{`${label} :`}</p>
        <p className="pl-6 font-GoodTimes">{balance}</p>
      </div>
    </div>
  )
}

export default function TeamTreasury({
  isSigner,
  safeData,
  multisigAddress,
}: TeamTreasuryProps) {
  const account = useActiveAccount()
  const address = account?.address
  const [safeModalEnabled, setSafeModalEnabled] = useState(false)
  const { data: safeBalances, isLoading } = useSafeBalances(
    multisigAddress,
    !!multisigAddress,
    process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? 'arbitrum' : 'sepolia'
  )

  return (
    <div className="w-full md:rounded-tl-[2vmax] p-5 md:pr-0 md:pb-24 overflow-hidden md:rounded-bl-[5vmax] bg-slide-section">
      {safeModalEnabled && (
        <SafeModal
          safeData={safeData}
          safeAddress={multisigAddress}
          isEnabled={safeModalEnabled}
          setEnabled={setSafeModalEnabled}
        />
      )}
      <div className="flex flex-col">
        <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center pr-12">
          <div className="flex gap-5 opacity-[50%]">
            <Image
              src={'/assets/icon-treasury.svg'}
              alt="Treasury icon"
              width={30}
              height={30}
            />
            <h2 className="header font-GoodTimes">Treasury</h2>
          </div>
          <div className="flex flex-col md:flex-row gap-2">
            <StandardButton
              className="min-w-[200px] gradient-2 rounded-[5vmax] rounded-bl-[10px]"
              onClick={() => {
                const safeNetwork =
                  process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? 'arb1' : 'sep'
                window.open(
                  `https://app.safe.global/home?safe=${safeNetwork}:${multisigAddress}`
                )
              }}
            >
              {'Treasury'}
            </StandardButton>
            {safeData && isSigner && (
              <StandardButton
                className="min-w-[200px] gradient-2 rounded-[5vmax] rounded-bl-[10px]"
                onClick={() => {
                  setSafeModalEnabled(true)
                }}
              >
                {'Manage'}
              </StandardButton>
            )}
          </div>
        </div>
        <div className="mt-4 flex items-center gap-4"></div>
        <div className="w-fit p-4 flex flex-col gap-4">
          {isLoading ? (
            <div>Loading balances...</div>
          ) : (
            safeBalances?.map((balance) => (
              <TreasuryAsset
                key={balance.tokenAddress || 'native'}
                label={balance.token?.symbol || 'ETH'}
                balance={formatUnits(
                  balance.balance,
                  balance.token?.decimals || 18
                )}
              />
            ))
          )}
        </div>
        {isSigner && <SafeTransactions address={address} safeData={safeData} />}
      </div>
    </div>
  )
}
