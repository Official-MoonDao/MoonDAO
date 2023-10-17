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
        <div className="px-4 py-2 w-[245px] flex flex-col gap-2 bg-moon-gold rounded-md ">
          <div className="flex justify-between">
            <p>{`${address?.slice(0, 6)}...${address?.slice(-4)}`}</p>
            <div
              className={`px-3 rounded-full duration-300 ease-in bg-amber-500 hover:bg-amber-600  ${
                enabled && 'bg-amber-600'
              }`}
              onClick={() => setEnabled(!enabled)}
            >
              <button
                className={`duration-300 ease-in-out ${
                  enabled && 'rotate-180'
                }`}
              >
                {enabled ? '▼' : '▽'}
              </button>
            </div>
          </div>
          {enabled && (
            <div className="animate-fadeIn mt-2 px-2 py-2 flex flex-col bg-amber-500 divide-y-2 gap-1">
              <p>
                <strong>Network : </strong>
                {
                  allChains.find(
                    (chain) =>
                      chain.chainId ===
                      +wallets?.[selectedWallet]?.chainId.split(':')[1]
                  )?.name
                }
              </p>
              <div>
                <strong>Wallets</strong>
                <div className="flex flex-col justify-between gap-1">
                  {wallets?.map((wallet, i) => (
                    <div key={`wallet-${i}`} className="flex gap-1">
                      <button
                        onClick={() => setSelectedWallet(i)}
                        className="w-4 h-6 bg-moon-gold"
                      >
                        {selectedWallet === i ? '✔' : ''}
                      </button>
                      <p>
                        <strong>
                          {wallet?.walletClientType.slice(0, 1).toUpperCase() +
                            wallet?.walletClientType.slice(1)}
                        </strong>
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
              <div>
                <LinkAccounts user={user} />
                <button
                  className="w-full mt-4 p-1 bg-moon-gold hover:bg-amber-600"
                  onClick={logout}
                >
                  <strong>Logout →</strong>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <button onClick={login} className="px-5 py-3 bg-moon-orange font-RobotoMono">
          Connect Wallet
        </button>
      )}
    </>
  )
}
