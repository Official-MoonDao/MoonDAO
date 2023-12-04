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
      <div className="flex flex-col gap-2 items-start justify-start w-[300px] md:w-[500px] h-[700px] p-8 bg-background-light dark:bg-background-dark rounded-md">
        <p className="absolut  mt-5 bg-[#CBE4F7] text-[#1F212B] dark:bg-[#D7594F36] dark:text-white  px-2 py-2 xl:py-3 xl:px-4 2xl:max-w-[750px] text-center xl:text-left text-sm xl:text-base">
          {`${extraFundsForGas} ${nativeTokenName} is added for gas fees.`}
        </p>
        <div className="flex flex-col w-full justify-between pt-8">
          <p className="flex gap-2 items-center py-2">
            <p className="border-2 rounded-full px-2 py-1">1</p>
            {`Purchase ${(nativeAmount + extraFundsForGas).toFixed(
              5
            )} ${nativeTokenName} with MoonPay`}
          </p>
          <button
            className="inline-flex justify-center w-full rounded-sm border border-transparent shadow-sm px-4 py-2 bg-moon-orange text-base font-medium text-white hover:bg-white hover:text-moon-orange focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-moon-orange"
            onClick={async () => {
              const wallet = wallets[selectedWallet]
              if (!wallet) return
              const provider = await wallet.getEthersProvider()
              const nativeBalance = await provider.getBalance(wallet.address)
              const formattedNativeBalance =
                ethers.utils.formatEther(nativeBalance)
              const levelPrice = nativeAmount + extraFundsForGas

              await fund(levelPrice - +formattedNativeBalance)
            }}
          >
            Buy with MoonPay
          </button>
        </div>
        <div className="w-full mt-8">
          <hr className="border-1 w-full" />
          <p className="w-full text-center">or</p>
          <hr className="border-1 w-full" />
        </div>
        <div className="flex flex-col w-full justify-between pt-8">
          <div className="flex gap-2 items-center py-2">
            <p className="border-2 rounded-full px-2 py-1">1</p>
            <p>
              Follow the{' '}
              <button
                className="text-moon-gold"
                onClick={() =>
                  window.open('https://www.coinbase.com/how-to-buy')
                }
              >
                guide
              </button>{' '}
              and create a Coinbase account
            </p>
          </div>
          <p className="flex gap-2 items-center py-2">
            <p className="border-2 rounded-full px-2 py-1">2</p>
            {`Purchase ${(nativeAmount + extraFundsForGas).toFixed(
              5
            )} ${nativeTokenName} with Coinbase`}
          </p>
          <button
            type="button"
            className="inline-flex justify-center w-full rounded-sm border border-transparent shadow-sm px-4 py-2 bg-moon-orange text-base font-medium text-white hover:bg-white hover:text-moon-orange focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-moon-orange"
            onClick={() => {
              navigator.clipboard.writeText(nativeAmount + extraFundsForGas)
              toast.success(nativeTokenName + ' value copied to clipboard')
            }}
          >
            {'Copy ' + nativeTokenName + ' Amount'}
          </button>
          <p className="flex gap-2 items-center py-2">
            <p className="border-2 rounded-full px-2 py-1">3</p>
            {'Send ' + nativeTokenName + ' to Wallet'}
          </p>
          <button
            type="button"
            className="inline-flex justify-center w-full rounded-sm border border-transparent shadow-sm px-4 py-2 bg-moon-orange text-base font-medium text-white hover:bg-white hover:text-moon-orange focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-moon-orange"
            onClick={() => {
              navigator.clipboard.writeText(wallets[selectedWallet].address)
              toast.success('Address copied to clipboard')
            }}
          >
            Copy Wallet Address
          </button>
        </div>
        <button
          className="inline-flex justify-center w-1/3 rounded-sm border border-transparent shadow-sm px-4 py-2 bg-[#2A2A2A] text-base font-medium text-white hover:bg-white hover:text-moon-orange focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-moon-orange"
          onClick={() => setEnabled(false)}
        >
          Back
        </button>
      </div>
    </div>
  )
}
