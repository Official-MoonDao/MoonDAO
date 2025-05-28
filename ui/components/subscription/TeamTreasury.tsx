import Image from 'next/image'
import { useState } from 'react'
import { useActiveAccount } from 'thirdweb/react'
import StandardButton from '../layout/StandardButton'
import SafeModal from '../safe/SafeModal'
import SafeTransactions from '../safe/SafeTransactions'

type TeamTreasuryProps = {
  safeData?: any
  multisigAddress: string
  multisigMooneyBalance: any
  multisigNativeBalance: any
  multisigDAIBalance: any
  multisigUSDCBalance: any
}

function TreasuryAsset({
  icon,
  label,
  balance,
}: {
  icon: string
  label: string
  balance: string
}) {
  return (
    <div className="flex gap-4 items-center text-lg justify-between">
      <Image src={icon} alt={icon} width={20} height={20} />
      <div className="flex gap-2">
        <p className="font-GoodTimes">{`${label} :`}</p>
        <p className="pl-6 font-GoodTimes">{balance}</p>
      </div>
    </div>
  )
}

export default function TeamTreasury({
  safeData,
  multisigAddress,
  multisigMooneyBalance,
  multisigNativeBalance,
  multisigDAIBalance,
  multisigUSDCBalance,
}: TeamTreasuryProps) {
  const account = useActiveAccount()
  const address = account?.address
  const [safeModalEnabled, setSafeModalEnabled] = useState(false)
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
            {safeData && (
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
          <TreasuryAsset
            icon={'/coins/MOONEY.png'}
            label={'MOONEY'}
            balance={multisigMooneyBalance}
          />
          <TreasuryAsset
            icon={'/coins/ETH.svg'}
            label={'ETHER'}
            balance={multisigNativeBalance}
          />
          <TreasuryAsset
            icon={'/coins/DAI.svg'}
            label={'DAI'}
            balance={multisigDAIBalance}
          />
          <TreasuryAsset
            icon={'/coins/USDC.svg'}
            label={'USDC'}
            balance={multisigUSDCBalance}
          />
        </div>
        <SafeTransactions address={address} safeData={safeData} />
      </div>
    </div>
  )
}
