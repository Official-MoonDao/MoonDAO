import {
  ArrowUpTrayIcon,
  ArrowsPointingOutIcon,
} from '@heroicons/react/24/outline'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { allChains } from '@thirdweb-dev/chains'
import { useAddress } from '@thirdweb-dev/react'
import { useRouter } from 'next/router'
import { useContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import PrivyWalletContext from '../../lib/privy/privy-wallet-context'
import { CopyIcon } from '../assets'
import { LinkAccounts } from './LinkAccounts'

export function PrivyConnectWallet() {
  const { selectedWallet, setSelectedWallet } = useContext(PrivyWalletContext)

  const address = useAddress()
  const { login, logout, user }: any = usePrivy()
  const { wallets } = useWallets()

  const [enabled, setEnabled] = useState(false)
  const [embeddedWallet, setEmbeddedWallet] = useState(false)

  return (
    <>
      {user && address ? (
        <div className="w-[200px] relative flex flex-col items-center justify-center px-5 py-3 bg-moon-orange font-RobotoMono">
          {/*Address and Toggle open/close button*/}
          <div className="flex items-center w-full justify-between">
            <p className='text-sm'>{`${address?.slice(0, 6)}...${address?.slice(-4)}`}</p>
            <div
              className={`ml-2 ease-in px-2 hover:scale-105 duration-150 transition-all border border-white ${
                enabled && ''
              }`}
              onClick={() => setEnabled(!enabled)}
            >
              <button
                className={`duration-300 ease-in-out text-white ${
                  enabled && 'rotate-180'
                }`}
              >
                {enabled ? '▼' : '▽'}
              </button>
            </div>
          </div>
          {/*Menu that opens up*/}
          {enabled && (
            <div className="text-sm w-[200px] font-RobotoMono absolute top-10 animate-fadeIn mt-2 px-2 py-2 flex flex-col bg-moon-orange divide-y-2 gap-2">
              <p className='font-semibold flex items-center gap-2'>
                Network:
                <span className='uppercase font-normal inline-block'>
                {
                  allChains.find(
                    (chain) =>
                    chain.chainId ===
                    +wallets?.[selectedWallet]?.chainId.split(':')[1]
                    )?.name
                  }
                  </span>
              </p>
              <div className='pt-1'>
                <p className='font-semibold'>Wallets:</p>
                <div className="mt-1 flex flex-col justify-between gap-2">
                  {wallets?.map((wallet, i) => (
                    <div key={`wallet-${i}`} className="flex gap-2 items-center text-[13px]">
                      {/*Button with tick */}
                      <button
                        onClick={() => setSelectedWallet(i)}
                        className="w-4 h-6 "
                      >
                        {selectedWallet === i ? '✔' : ''}
                      </button>
                      {/*Wallet address and copy button*/}
                      <p>
                       <span className='uppercase'>

                          {wallet?.walletClientType.slice(0, 1).toUpperCase() +
                            wallet?.walletClientType.slice(1)}
                            </span>
                     
                        <br></br>
                        {wallet?.address.slice(0, 6) +
                          '...' +
                          wallet?.address.slice(-4)}
                      </p>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(wallet.address)
                          toast.success('Address copied to clipboard')
                        }}
                      >
                        <CopyIcon />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className='pt-1'>
                <LinkAccounts user={user} />
                <button
                  className="w-full mt-4 p-1 border border-white text-white hover:scale-105 transition-all duration-150 hover:bg-orange-700"
                  onClick={logout}
                >
                  <strong>Logout →</strong>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <button onClick={login} className="w-[200px] px-5 py-3 bg-moon-orange font-RobotoMono">
          Connect Wallet
        </button>
      )}
    </>
  )
}
