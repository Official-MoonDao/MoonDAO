import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { allChains } from '@thirdweb-dev/chains'
import { useAddress, useContract } from '@thirdweb-dev/react'
import Image from 'next/image'
import { useContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import PrivyWalletContext from '../../lib/privy/privy-wallet-context'
import ChainContext from '../../lib/thirdweb/chain-context'
import { useHandleRead } from '../../lib/thirdweb/hooks'
import { useImportToken } from '../../lib/utils/import-token'
import ERC20 from '../../const/abis/ERC20.json'
import { MOONEY_ADDRESSES } from '../../const/config'
import { CopyIcon } from '../assets'
import { LinkAccounts } from './LinkAccounts'

function EthIcon() {
  return (
    <div className="flex justify-center items-center p-4 rounded-full bg-[#0B3B8E] h-12 w-12">
      <Image
        className="scale-2"
        src={'/icons/networks/ethereum.svg'}
        width={100}
        height={100}
        alt=""
      />
    </div>
  )
}

function PolygonIcon() {
  return (
    <div className="flex justify-center items-center p-4 rounded-full bg-[#8247E52B] h-12 w-12">
      <Image
        src={'/icons/networks/polygon.svg'}
        width={50}
        height={50}
        alt=""
      />
    </div>
  )
}

export function PrivyConnectWallet() {
  const { selectedWallet, setSelectedWallet } = useContext(PrivyWalletContext)
  const { selectedChain, setSelectedChain }: any = useContext(ChainContext)

  const [networkMistmatch, setNetworkMismatch] = useState(false)

  const address = useAddress()
  const [nativeBalance, setNativeBalance] = useState(0)
  const [walletChainId, setWalletChainId] = useState(1)
  const { login, logout, user }: any = usePrivy()
  const { wallets } = useWallets()

  const [enabled, setEnabled] = useState(false)

  const { contract: mooneyContract } = useContract(
    MOONEY_ADDRESSES[selectedChain.slug],
    ERC20.abi
  )

  const { data: mooneyBalance } = useHandleRead(mooneyContract, 'balanceOf', [
    address,
  ])

  const importToken = useImportToken(selectedChain)
  //get native balance

  async function getNativeBalance() {
    const provider = await wallets[selectedWallet].getEthersProvider()
    const nB: any = await provider.getBalance(wallets[selectedWallet].address)
    setNativeBalance(+(nB.toString() / 10 ** 18).toFixed(5))
  }

  useEffect(() => {
    if (wallets?.[0]) {
      setWalletChainId(+wallets?.[0]?.chainId.split(':')[1])
      getNativeBalance()
    }
  }, [wallets, selectedWallet])

  useEffect(() => {
    if (walletChainId !== selectedChain.chainId) setNetworkMismatch(true)
    else setNetworkMismatch(false)
  }, [walletChainId, selectedChain])

  function NetworkIcon() {
    return (
      <>
        {selectedChain.chainId === 1 || selectedChain.chainId === 5 ? (
          <EthIcon />
        ) : (
          <PolygonIcon />
        )}
      </>
    )
  }

  return (
    <>
      {user && wallets?.[0] ? (
        <div
          id="privy-connect-wallet"
          className={`w-[125px] md:w-[175px] md:full relative flex flex-col items-right justify-center px-3 md:px-5 py-2 md:py-3 bg-moon-orange font-RobotoMono z-[10] rounded-sm hover:rounded-tl-[22px] hover:rounded-br-[22px] duration-300`}
          onClick={(e: any) => {
            !e.target.closest('#privy-connect-wallet-dropdown') &&
              setEnabled(!enabled)
          }}
        >
          {/*Address and Toggle open/close button*/}
          <div className="flex items-center w-full h-full justify-between">
            <p className="text-xs">{`${wallets?.[selectedWallet].address?.slice(
              0,
              6
            )}...${wallets?.[selectedWallet].address?.slice(-4)}`}</p>
          </div>
          {/*Menu that opens up*/}
          {enabled && (
            <div
              id="privy-connect-wallet-dropdown"
              className="mt-4 w-[325px] text-sm font-RobotoMono absolute top-10 left-[-30%] md:left-[-50%] animate-fadeIn mt-2 px-2 py-2 flex flex-col bg-[#0A0E22] divide-y-2 divide-[#FFFFFF14] gap-2"
            >
              <div>
                <div className="flex items-center">
                  <NetworkIcon />
                  <div className="ml-2">
                    <p className="uppercase font-normal inline-block">
                      {
                        allChains.find(
                          (chain) => chain.chainId === selectedChain.chainId
                        )?.name
                      }
                    </p>
                    <p className="text-sm">{`${wallets?.[
                      selectedWallet
                    ].address?.slice(0, 6)}...${wallets?.[
                      selectedWallet
                    ].address?.slice(-4)}`}</p>
                  </div>
                  <button
                    className="ml-4"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        wallets[selectedWallet].address
                      )
                      toast.success('Address copied to clipboard')
                    }}
                  >
                    <CopyIcon />
                  </button>
                  <button
                    className="p-4 absolute right-0"
                    onClick={() => setEnabled(false)}
                  >
                    <ChevronDownIcon height={20} width={20} />
                  </button>
                </div>
              </div>
              {networkMistmatch ? (
                <div>
                  <button
                    className="w-full mt-4 p-2 border text-white hover:scale-105 transition-all duration-150 border-white hover:bg-white hover:text-moon-orange"
                    onClick={() => {
                      wallets[selectedWallet].switchChain(selectedChain.chainId)
                    }}
                  >
                    {`Switch to ${
                      allChains.find(
                        (chain) => chain.chainId === selectedChain.chainId
                      )?.name
                    }`}
                  </button>
                </div>
              ) : (
                <div className="w-full flex flex-col gap-2 py-2">
                  <div className=" w-full flex justify-left items-center gap-4">
                    <Image
                      src="/coins/MOONEY.png"
                      width={45}
                      height={45}
                      alt=""
                    />
                    <p>
                      {mooneyBalance
                        ? (mooneyBalance?.toString() / 10 ** 18).toFixed(2)
                        : '...'}
                    </p>
                    <p>$MOONEY</p>
                  </div>

                  <div className=" w-full flex justify-left items-center gap-4">
                    <NetworkIcon />
                    <p>{nativeBalance}</p>
                    <p>
                      {walletChainId === 1 || walletChainId === 5
                        ? 'ETH'
                        : 'MATIC'}
                    </p>
                  </div>
                </div>
              )}

              <div className="pt-1">
                <p className="font-semibold">Wallets:</p>
                <div className="mt-1 flex flex-col justify-between gap-2">
                  {wallets?.map((wallet, i) => (
                    <div
                      key={`wallet-${i}`}
                      className="flex gap-2 items-center text-[13px]"
                    >
                      {/*Button with tick */}
                      <button
                        onClick={() => setSelectedWallet(i)}
                        className="w-4 h-6 "
                      >
                        {selectedWallet === i ? '■' : '□'}
                      </button>
                      {/*Wallet address and copy button*/}
                      <p>
                        <span className="uppercase font-bold">
                          {wallet?.walletClientType.slice(0, 1).toUpperCase() +
                            wallet?.walletClientType.slice(1)}
                        </span>

                        <br></br>
                        {wallet?.address.slice(0, 6) +
                          '...' +
                          wallet?.address.slice(-4)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pt-1">
                <LinkAccounts user={user} />
                <div className="flex justify-between">
                  <button
                    className="w-2/5 mt-4 p-1 border text-white hover:scale-105 transition-all duration-150 border-white hover:bg-white hover:text-moon-orange"
                    onClick={importToken}
                  >
                    <strong>Import Token</strong>
                  </button>
                  <button
                    className="w-2/5 mt-4 p-1 border text-white transition-all duration-150 bg-moon-orange hover:bg-white hover:text-moon-orange"
                    onClick={async () => {
                      wallets.forEach((wallet) => wallet.disconnect())
                      logout()
                    }}
                  >
                    <strong>Log out</strong>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={async () => {
            if (user) {
              await logout()
              login()
            } else {
              login()
            }
          }}
          className="w-[125px] md:w-[175px] px-3 md:px-5 py-2 md:py-3 bg-moon-orange font-RobotoMono hover:scale-105 transition-all duration-150 hover:bg-white hover:text-moon-orange rounded-sm hover:rounded-tl-[22px] hover:rounded-br-[22px] duration-300"
        >
          Connect
        </button>
      )}
    </>
  )
}
