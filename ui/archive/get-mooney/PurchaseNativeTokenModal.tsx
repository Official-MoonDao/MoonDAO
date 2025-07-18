import { ethers } from 'ethers'
import { useMemo } from 'react'
import toast from 'react-hot-toast'
import { useMoonPay } from '../../lib/privy/hooks/useMoonPay'

export function PurhcaseNativeTokenModal({
  wallets,
  selectedWallet,
  selectedChain,
  nativeAmount,
  extraFundsForGas,
  setEnabled,
  nativeBalance,
}: any) {
  //MoonPay
  const fund = useMoonPay()

  const nativeTokenName = useMemo(() => {
    const slug = selectedChain.slug
    if (slug === 'ethereum' || slug === 'goerli') return 'ETH'
    if (slug === 'polygon' || slug === 'mumbai') return 'MATIC'
  }, [selectedChain])

  return (
    <div
      onClick={(e: any) => {
        if (e.target.id === 'purchase-native-modal-backdrop') setEnabled(false)
      }}
      id="purchase-native-modal-backdrop"
      className="fixed top-0 left-0 w-screen h-screen bg-[#00000080] backdrop-blur-sm flex justify-center items-center z-[1000]"
    >
      <div className="flex flex-col gap-2 items-center justify-start w-[300px] md:w-[500px] h-[590px] p-12 bg-background-light dark:bg-background-dark rounded-md">
        <p className="absolut  mt-5 bg-[#CBE4F7] text-[#1F212B] dark:bg-[#D7594F36] dark:text-white  px-2 py-2 xl:py-3 xl:px-4 2xl:max-w-[750px] text-center xl:text-left text-sm xl:text-base">
          {`${extraFundsForGas} ${nativeTokenName} is added for gas fees.`}
        </p>
        <div className="flex flex-col w-full justify-between items-start pt-8">
          <p className="flex gap-2 items-center py-2 flex-row gap-3">
            <p className="border-2 rounded-full px-2 py-1">1</p>
            <span>
              Follow the{' '}
              <a
                className="text-moon-gold"
                href={`https://www.coinbase.com/how-to-buy/${selectedChain.slug}`}
                target="_blank"
                rel="noreferrer"
              >
                guide
              </a>{' '}
              and create a Coinbase account
            </span>
          </p>
          <p className="flex gap-3 overflow-wrap items-center py-2">
            <p className="border-2 rounded-full px-2 py-1">2</p>
            <span>
              Purchase{' '}
              <a className="text-moon-gold">
                {(nativeAmount + extraFundsForGas - nativeBalance).toFixed(5)}
              </a>{' '}
              {nativeTokenName} with Coinbase
            </span>
          </p>
          <div className="pl-9 w-full">
            <button
              type="button"
              className="m-2 inline-flex justify-center w-3/4 rounded-sm border border-transparent shadow-sm px-4 py-2 bg-moon-orange text-base font-medium text-white hover:bg-white hover:text-moon-orange focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-moon-orange"
              onClick={() => {
                navigator.clipboard.writeText(nativeAmount + extraFundsForGas)
                toast.success(nativeTokenName + ' value copied to clipboard.')
              }}
            >
              {'Copy ' + nativeTokenName + ' Amount'}
            </button>
          </div>
          <p className="flex gap-3 items-center py-2">
            <p className="border-2 rounded-full px-2 py-1">3</p>
            {'Send ' + nativeTokenName + ' to Wallet on Polygon Network'}
          </p>
          <div className="pl-9 w-full">
            <button
              type="button"
              className="m-2 inline-flex justify-center w-3/4 rounded-sm border border-transparent shadow-sm px-4 py-2 bg-moon-orange text-base font-medium text-white hover:bg-white hover:text-moon-orange focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-moon-orange"
              onClick={() => {
                navigator.clipboard.writeText(wallets[selectedWallet].address)
                toast.success('Address copied to clipboard.')
              }}
            >
              Copy Wallet Address
            </button>
          </div>
          <div className="mt-8 pl-11 w-full">
            <button
              className="inline-flex justify-center w-3/4 rounded-sm border border-transparent shadow-sm px-4 py-2 bg-[#2A2A2A] text-base font-medium text-white hover:bg-white hover:text-moon-orange focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-moon-orange"
              onClick={() => setEnabled(false)}
            >
              Back
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
