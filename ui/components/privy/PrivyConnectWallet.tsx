import {
  ArrowDownOnSquareIcon,
  ArrowUpRightIcon,
  ChevronDownIcon,
  PlusIcon,
  WalletIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import {
  useFundWallet,
  useLogin,
  usePrivy,
  useWallets,
} from '@privy-io/react-auth'
import { useAddress, useContract, useSDK } from '@thirdweb-dev/react'
import { ethers } from 'ethers'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useContext, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import PrivyWalletContext from '../../lib/privy/privy-wallet-context'
import ChainContext from '../../lib/thirdweb/chain-context'
import { useNativeBalance } from '../../lib/thirdweb/hooks/useNativeBalance'
import { useENS } from '../../lib/utils/hooks/useENS'
import { useImportToken } from '../../lib/utils/import-token'
import { generatePrettyLinkWithId } from '@/lib/subscription/pretty-links'
import useWatchTokenBalance from '@/lib/tokens/hooks/useWatchTokenBalance'
import viemChains from '@/lib/viem/viemChains'
import ERC20 from '../../const/abis/ERC20.json'
import {
  CITIZEN_ADDRESSES,
  DAI_ADDRESSES,
  MOONEY_ADDRESSES,
  USDC_ADDRESSES,
  USDT_ADDRESSES,
} from '../../const/config'
import { CopyIcon } from '../assets'
import FormInput from '../forms/FormInput'
import Modal from '../layout/Modal'
import CitizenProfileLink from '../subscription/CitizenProfileLink'
import NetworkSelector from '../thirdweb/NetworkSelector'
import { LinkAccounts } from './LinkAccounts'
import { PrivyWeb3Button } from './PrivyWeb3Button'
import WalletAction from './WalletAction'

type PrivyConnectWalletProps = {
  citizenContract?: any
  type?: 'mobile' | 'desktop'
}

const selectedNativeToken: any = {
  arbitrum: 'ETH',
  ethereum: 'ETH',
  base: 'ETH',
  sepolia: 'ETH',
  'base-sepolia-testnet': 'ETH',
  polygon: 'MATIC',
}

function SendModal({
  selectedChain,
  networkIcon,
  mooneyContract,
  daiContract,
  usdcContract,
  usdtContract,
  setEnabled,
  nativeBalance,
  formattedBalances,
}: any) {
  const sdk = useSDK()

  const [to, setTo] = useState<string>()
  const [amount, setAmount] = useState<number>()
  const [selectedToken, setSelectedToken] = useState<string>('native')

  const [balance, setBalance] = useState()

  const selectedTokenIcon = useMemo(() => {
    let icon
    if (selectedToken === 'native') {
      icon = networkIcon
    } else {
      icon = (
        <Image
          src={`/coins/${selectedToken.toUpperCase()}.${
            selectedToken === 'mooney' ? 'png' : 'svg'
          }`}
          width={30}
          height={30}
          alt=""
        />
      )
    }

    return icon
  }, [selectedToken, networkIcon])

  const tokenContracts: { [key: string]: any } = {
    mooney: mooneyContract,
    dai: daiContract,
    usdc: usdcContract,
    usdt: usdtContract,
  }

  useEffect(() => {
    if (selectedToken === 'native') {
      setBalance(nativeBalance)
    } else {
      setBalance(formattedBalances[selectedToken])
    }
  }, [selectedToken, nativeBalance, formattedBalances])

  return (
    <Modal id="send-modal-backdrop" setEnabled={setEnabled}>
      <form
        className="w-full flex flex-col gap-2 items-start justify-start w-auto md:w-[500px] p-4 md:p-8 bg-[#080C20] rounded-md"
        onSubmit={async (e) => {
          e.preventDefault()

          if (!to || !amount) {
            return toast.error('Please fill in all fields')
          } else if (to.length !== 42 || !to.startsWith('0x')) {
            return toast.error('Invalid address')
          } else if (amount <= 0) {
            return toast.error('Invalid amount')
          }

          const formattedAmount = ethers.utils.parseEther(amount.toString())

          try {
            if (selectedToken === 'native') {
              if (+amount > nativeBalance)
                return toast.error('Insufficient funds')

              const signer = sdk?.getSigner()

              await signer?.sendTransaction({
                to,
                value: formattedAmount,
              })
            } else {
              if (+amount > formattedBalances[selectedToken])
                return toast.error('Insufficient funds')

              await tokenContracts[selectedToken].call('transfer', [
                to,
                formattedAmount,
              ])
            }
          } catch (err) {
            console.log(err)
          }
        }}
      >
        <div className="w-full flex items-center justify-between">
          <div>
            <h2 className="font-GoodTimes">{'Send Funds'}</h2>
          </div>
          <button
            type="button"
            className="flex h-10 w-10 border-2 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
            onClick={() => setEnabled(false)}
          >
            <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
          </button>
        </div>

        <NetworkSelector iconsOnly />

        <div className="flex gap-4 items-center">
          <select
            className="`w-full p-2 border-2 dark:border-0 dark:bg-[#0f152f] rounded-sm"
            onChange={({ target }) => setSelectedToken(target.value)}
          >
            <option value={'native'}>
              {selectedNativeToken[selectedChain.slug]}
            </option>
            <option value={'mooney'}>{'MOONEY'}</option>
            <option value={'dai'}>{'DAI'}</option>
            <option value={'usdc'}>{'USDC'}</option>
            <option value={'usdt'}>{'USDT'}</option>
          </select>

          {selectedTokenIcon}

          <p>{balance && balance}</p>
        </div>

        <FormInput
          value={to}
          onChange={({ target }: any) => setTo(target.value)}
          placeholder="To"
        />
        <FormInput
          value={amount}
          onChange={({ target }: any) => setAmount(target.value)}
          placeholder="Amount"
        />
        <PrivyWeb3Button
          className="w-full"
          label="Send"
          type="submit"
          action={() => {}}
        />
      </form>
    </Modal>
  )
}

export function PrivyConnectWallet({
  citizenContract,
  type,
}: PrivyConnectWalletProps) {
  const sdk = useSDK()
  const router = useRouter()

  const { selectedWallet, setSelectedWallet } = useContext(PrivyWalletContext)
  const { selectedChain, setSelectedChain }: any = useContext(ChainContext)

  const [networkMistmatch, setNetworkMismatch] = useState(false)

  const address = useAddress()
  const { data: _ensData } = useENS(address)
  const ens = _ensData?.name
  const [walletChainId, setWalletChainId] = useState(1)
  const { logout, user, authenticated, connectWallet, exportWallet }: any =
    usePrivy()

  const { login } = useLogin({
    onComplete: async (user, isNewUser, wasAlreadyAuthenticated) => {
      //If the user signs in and wasn't already authenticated, check if they have a citizen NFT and redirect them to their profile or the guest page
      if (!wasAlreadyAuthenticated) {
        let citizen
        try {
          const citizenContract = await sdk?.getContract(
            CITIZEN_ADDRESSES[selectedChain.slug]
          )
          const ownedTokenId = await citizenContract?.call('getOwnedToken', [
            address,
          ])
          citizen = await citizenContract?.erc721.get(ownedTokenId)
        } catch (err) {
          citizen = undefined
        }
        if (citizen) {
          router.push(
            `/citizen/${generatePrettyLinkWithId(
              citizen?.metadata?.name as string,
              citizen?.metadata?.id
            )}`
          )
        } else {
          router.push('/citizen/guest')
        }
      }
    },
  })
  const { wallets } = useWallets()

  const { fundWallet } = useFundWallet()

  const [enabled, setEnabled] = useState(false)
  const [sendModalEnabled, setSendModalEnabled] = useState(false)

  const { contract: mooneyContract } = useContract(
    MOONEY_ADDRESSES[selectedChain.slug],
    ERC20.abi
  )

  const { contract: daiContract } = useContract(
    DAI_ADDRESSES[selectedChain.slug],
    ERC20.abi
  )

  const { contract: usdcContract } = useContract(
    USDC_ADDRESSES[selectedChain.slug],
    ERC20.abi
  )

  const { contract: usdtContract } = useContract(
    USDT_ADDRESSES[selectedChain.slug],
    ERC20.abi
  )

  const nativeBalance = useNativeBalance()

  const [formattedBalances, setFormattedBalances] = useState({
    mooney: 0,
    dai: 0,
    usdc: 0,
    usdt: 0,
  })

  const mooneyBalance = useWatchTokenBalance(mooneyContract, 18)
  const daiBalance = useWatchTokenBalance(daiContract, 18)
  const usdcBalance = useWatchTokenBalance(usdcContract, 6)
  const usdtBalance = useWatchTokenBalance(usdtContract, 6)

  useEffect(() => {
    if (mooneyBalance >= 0)
      setFormattedBalances((prev) => ({
        ...prev,
        mooney: mooneyBalance?.toFixed(2),
      }))
  }, [mooneyBalance])
  useEffect(() => {
    if (daiBalance)
      setFormattedBalances((prev) => ({
        ...prev,
        dai: daiBalance.toFixed(2),
      }))
  }, [daiBalance])
  useEffect(() => {
    if (usdcBalance)
      setFormattedBalances((prev) => ({
        ...prev,
        usdc: usdcBalance.toFixed(2),
      }))
  }, [usdcBalance])
  useEffect(() => {
    if (usdtBalance)
      setFormattedBalances((prev) => ({
        ...prev,
        usdt: usdtBalance.toFixed(2),
      }))
  }, [usdtBalance])

  const importToken = useImportToken(selectedChain)

  function NetworkIcon() {
    return (
      <Image
        src={`/icons/networks/${selectedChain.slug}.svg`}
        width={
          selectedChain.slug === 'ethereum' || selectedChain.slug === 'sepolia'
            ? 25
            : 30
        }
        height={
          selectedChain.slug === 'ethereum' || selectedChain.slug === 'sepolia'
            ? 25
            : 30
        }
        alt="Network Icon"
      />
    )
  }

  function NativeTokenIcon() {
    return (
      <Image
        src={`/icons/networks/${
          selectedChain.slug === 'polygon' ? 'polygon' : 'ethereum'
        }.svg`}
        width={
          selectedChain.slug === 'ethereum' ||
          selectedChain.slug === 'arbitrum' ||
          selectedChain.slug === 'sepolia'
            ? 25
            : 30
        }
        height={
          selectedChain.slug === 'ethereum' ||
          selectedChain.slug === 'arbitrum' ||
          selectedChain.slug === 'sepolia'
            ? 25
            : 30
        }
        alt="Native Token Icon"
      />
    )
  }

  useEffect(() => {
    if (wallets?.[0]) {
      setWalletChainId(+wallets?.[selectedWallet]?.chainId.split(':')[1])
    }
  }, [wallets, selectedWallet])

  useEffect(() => {
    if (walletChainId !== selectedChain.chainId) setNetworkMismatch(true)
    else setNetworkMismatch(false)
  }, [walletChainId, selectedChain, selectedWallet])

  //detect outside click
  function handleClickOutside({ target }: any) {
    if (
      target.closest('#privy-connect-wallet-dropdown') ||
      target.closest('#privy-connect-wallet') ||
      target.closest('#privy-modal-content') ||
      target.closest('#headlessui-dialog-panel') ||
      target.closest('#send-modal-backdrop')
    )
      return
    setEnabled(false)
  }
  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <>
      {user && wallets?.[0] ? (
        <div className="w-full">
          <div
            id="privy-connect-wallet"
            className={`cursor-pointer flex-wrap md:w-[175px] md:full relative flex flex-col items-right justify-center pl-5 pr-5 py-2 md:hover:pl-[25px] gradient-2 font-RobotoMono z-[10] rounded-[2vmax] rounded-tl-[10px] duration-300`}
            onClick={(e: any) => {
              setEnabled(!enabled)
            }}
          >
            {/*Address and Toggle open/close button*/}
            <div className="flex items-center w-full h-full justify-between">
              <p className="text-xs">
                {ens
                  ? ens
                  : address
                  ? `${address?.slice(0, 6)}...${address?.slice(-4)}`
                  : ''}
              </p>
              <ChevronDownIcon
                className={`w-4 h-4 text-black dark:text-white cursor-pointer transition-all duration-150 ${
                  enabled ? 'rotate-180' : ''
                }`}
              />
            </div>
            {/*Menu that opens up*/}
          </div>
          {enabled && (
            <div
              id="privy-connect-wallet-dropdown"
              className="w-[260px] lg:w-[270px] absolute left-0 text-sm font-RobotoMono rounded-tr-[20px] rounded-br-[2vmax] animate-fadeIn mt-2 p-2 flex flex-col gradient-14 text-white divide-y-2 divide-[#FFFFFF14] gap-2 z-[100] lg:max-h-[70%] overflow-y-scroll overflow-x-hidden z-[3000]"
            >
              {sendModalEnabled && (
                <SendModal
                  selectedChain={selectedChain}
                  setEnabled={setSendModalEnabled}
                  networkIcon={<NetworkIcon />}
                  mooneyContract={mooneyContract}
                  daiContract={daiContract}
                  usdcContract={usdcContract}
                  usdtContract={usdtContract}
                  nativeBalance={nativeBalance}
                  formattedBalances={formattedBalances}
                />
              )}
              <div className={`w-full flex items-center justify-between`}>
                <div className="flex items-center justify-center gap-4">
                  <div className="w-[50px]">
                    <NetworkSelector iconsOnly />
                  </div>
                  {type === 'mobile' && (
                    <div className="pt-2">
                      <CitizenProfileLink
                        selectedChain={selectedChain}
                        citizenContract={citizenContract}
                      />
                    </div>
                  )}
                </div>
                <XMarkIcon
                  className="w-6 h-6 text-black dark:text-white cursor-pointer"
                  onClick={() => setEnabled(false)}
                />
              </div>
              <div className="relative mt-2">
                <div className="w-full mt-2 flex items-center">
                  <div className="ml-2 bg-dark-cool">
                    <p className="text-sm">{`${address?.slice(
                      0,
                      6
                    )}...${address?.slice(-4)}`}</p>
                  </div>
                  <button
                    className="ml-4"
                    onClick={() => {
                      navigator.clipboard.writeText(address || '')
                      toast.success('Address copied to clipboard')
                    }}
                  >
                    <CopyIcon />
                  </button>
                </div>
              </div>
              {networkMistmatch ? (
                <div>
                  <button
                    className="w-full mt-4 p-2 border hover:scale-105 transition-all duration-150 hover:border-light-warm hover:text-light-warm rounded-lg"
                    onClick={() => {
                      wallets[selectedWallet].switchChain(selectedChain.chainId)
                    }}
                  >
                    {`Switch to ${selectedChain.name}`}
                  </button>
                </div>
              ) : (
                <div className="w-full flex flex-col gap-2 py-2">
                  <div className=" w-full flex justify-left items-center gap-4">
                    <Image
                      src="/coins/MOONEY.png"
                      width={30}
                      height={30}
                      alt=""
                    />
                    <p>{formattedBalances.mooney + ' MOONEY'}</p>
                  </div>

                  <div className=" w-full flex justify-left items-center gap-4">
                    <NativeTokenIcon />
                    <p>
                      {nativeBalance +
                        ' ' +
                        selectedNativeToken[selectedChain.slug]}
                    </p>
                  </div>

                  {formattedBalances.dai > 0 && (
                    <div className=" w-full flex justify-left items-center gap-4">
                      <Image
                        src="/coins/DAI.svg"
                        width={30}
                        height={30}
                        alt=""
                      />
                      <p>{formattedBalances.dai + ' DAI'}</p>
                    </div>
                  )}

                  {formattedBalances.usdc > 0 && (
                    <div className=" w-full flex justify-left items-center gap-4">
                      <Image
                        src="/coins/USDC.svg"
                        width={30}
                        height={30}
                        alt=""
                      />
                      <p>{usdcBalance + ' USDC'}</p>
                    </div>
                  )}
                  {formattedBalances.usdt > 0 && (
                    <div className=" w-full flex justify-left items-center gap-4">
                      <Image
                        src="/coins/USDT.svg"
                        width={30}
                        height={30}
                        alt=""
                      />
                      <p>{usdtBalance + ' USDT'}</p>
                    </div>
                  )}
                </div>
              )}

              <div
                id="wallet-actions-container"
                className="pt-4 pb-8 flex gap-5"
              >
                <WalletAction
                  id="wallet-fund-action"
                  label="Fund"
                  icon={<PlusIcon width={25} height={25} />}
                  onClick={async () => {
                    if (!address)
                      return toast.error('Please connect your wallet')
                    fundWallet(address, {
                      chain: viemChains[selectedChain.slug],
                      asset: 'native-currency',
                    })
                  }}
                />
                <WalletAction
                  id="wallet-send-action"
                  label="Send"
                  icon={<ArrowUpRightIcon width={25} height={25} />}
                  onClick={() => {
                    setSendModalEnabled(true)
                  }}
                />
                <WalletAction
                  id="wallet-add-wallet-action"
                  label="Add Wallet"
                  icon={<WalletIcon width={25} height={25} />}
                  onClick={() => {
                    connectWallet()
                  }}
                />
                {wallets[selectedWallet]?.walletClientType === 'privy' && (
                  <WalletAction
                    id="wallet-export-action"
                    label="Export"
                    icon={<ArrowDownOnSquareIcon width={25} height={25} />}
                    onClick={() => {
                      exportWallet().catch(() => {
                        toast.error('Please select a privy wallet to export.')
                      })
                    }}
                  />
                )}
              </div>

              <div className="pt-1">
                <p className="font-semibold">Wallets:</p>
                <div className="mt-1 flex flex-col justify-start gap-2">
                  {wallets?.map((wallet, i) => (
                    <div
                      key={`wallet-${i}`}
                      className="w-full flex gap-2 items-center text-[13px]"
                    >
                      {/*Button with tick */}
                      <button
                        onClick={() => setSelectedWallet(i)}
                        className="w-4 h-6 "
                      >
                        {selectedWallet === i ? '■' : '□'}
                      </button>
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
                      {/*Wallet address and copy button*/}
                      {wallet.walletClientType != 'metamask' && (
                        <button
                          className="ml-12"
                          onClick={() => wallet.disconnect()}
                        >
                          X
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="pt-1">
                <LinkAccounts user={user} />
                <div className="flex justify-between">
                  {/* <button
                    className="w-2/5 mt-4 p-1 border text-white hover:scale-105 transition-all duration-150 border-white hover:bg-white hover:text-moon-orange"
                    onClick={importToken}
                  >
                    <strong>Import Token</strong>
                  </button> */}
                  <button
                    className="w-full mt-4 p-1 rounded-[2vmax] text-white transition-all duration-150 p-5 py-2 md:hover:pl-[25px] gradient-2"
                    onClick={async () => {
                      wallets.forEach((wallet) => wallet.disconnect())
                      logout()
                    }}
                  >
                    <strong>Log Out</strong>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="w-full">
          <button
            onClick={async () => {
              if (user) {
                await logout()
                login()
              } else {
                login()
              }
            }}
            className="text-[12px] md:text-[18px] font-bold rounded-[40px] rounded-bl-[10px] p-5 py-2 md:hover:pl-[25px] gradient-2 transition-all duration-150"
          >
            <div className="flex">
              <Image
                src="/assets/icon-user.svg"
                alt="Sign in with your wallet"
                width="20"
                height="20"
              ></Image>
              <p className="pl-2">Sign In</p>
            </div>
          </button>
        </div>
      )}
    </>
  )
}
