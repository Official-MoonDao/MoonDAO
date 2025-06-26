import {
  ArrowDownOnSquareIcon,
  ArrowUpRightIcon,
  ChevronDownIcon,
  ClipboardDocumentIcon,
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
import CitizenABI from 'const/abis/Citizen.json'
import { ethers } from 'ethers'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useContext, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import toast from 'react-hot-toast'
import {
  getContract,
  prepareContractCall,
  readContract,
  sendAndConfirmTransaction,
} from 'thirdweb'
import { getNFT } from 'thirdweb/extensions/erc721'
import { useActiveAccount } from 'thirdweb/react'
import PrivyWalletContext from '../../lib/privy/privy-wallet-context'
import { useNativeBalance } from '../../lib/thirdweb/hooks/useNativeBalance'
import { useENS } from '../../lib/utils/hooks/useENS'
import { useImportToken } from '../../lib/utils/import-token'
import { generatePrettyLinkWithId } from '@/lib/subscription/pretty-links'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import client from '@/lib/thirdweb/client'
import useContract from '@/lib/thirdweb/hooks/useContract'
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

const PATHS_WITH_NO_SIGNIN_REDIRECT = [
  '/',
  '/submit',
  '/withdraw',
  '/projects',
  '/proposal/[proposal]',
  '/lock',
  '/join',
  '/get-mooney',
  '/bridge',
  '/citizen',
  '/citizen/[tokenId]',
  '/team',
  '/team/[tokenId]',
  '/launch',
  '/mission',
  '/mission/[tokenId]',
]

function SendModal({
  account,
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
  const chainSlug = getChainSlug(selectedChain)
  const [to, setTo] = useState<string>('')
  const [amount, setAmount] = useState<string>('')
  const [selectedToken, setSelectedToken] = useState<string>('native')
  const [isLoading, setIsLoading] = useState(false)

  const balance = useMemo(() => {
    if (selectedToken === 'native') {
      return nativeBalance
    } else {
      return formattedBalances[selectedToken] || 0
    }
  }, [selectedToken, nativeBalance, formattedBalances])

  const selectedTokenData = useMemo(() => {
    const tokens = {
      native: {
        symbol: selectedNativeToken[chainSlug],
        icon: networkIcon,
        description: 'Native Token',
      },
      mooney: {
        symbol: 'MOONEY',
        icon: (
          <Image
            src="/coins/MOONEY.png"
            width={24}
            height={24}
            alt="MOONEY"
            className="rounded-full"
          />
        ),
        description: 'Governance Token',
      },
      dai: {
        symbol: 'DAI',
        icon: <Image src="/coins/DAI.svg" width={24} height={24} alt="DAI" />,
        description: 'Stablecoin',
      },
      usdc: {
        symbol: 'USDC',
        icon: <Image src="/coins/USDC.svg" width={24} height={24} alt="USDC" />,
        description: 'USD Coin',
      },
      usdt: {
        symbol: 'USDT',
        icon: <Image src="/coins/USDT.svg" width={24} height={24} alt="USDT" />,
        description: 'Tether USD',
      },
    }
    return tokens[selectedToken as keyof typeof tokens]
  }, [selectedToken, networkIcon, chainSlug])

  const tokenContracts: { [key: string]: any } = {
    mooney: mooneyContract,
    dai: daiContract,
    usdc: usdcContract,
    usdt: usdtContract,
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      if (!to || !amount) {
        return toast.error('Please fill in all fields.')
      } else if (to.length !== 42 || !to.startsWith('0x')) {
        return toast.error('Invalid address.')
      } else if (Number(amount) <= 0) {
        return toast.error('Invalid amount.')
      }

      const numAmount = Number(amount)
      const formattedAmount = ethers.utils.parseEther(amount.toString())

      let receipt
      if (selectedToken === 'native') {
        if (numAmount > nativeBalance) {
          return toast.error('Insufficient funds.')
        }

        receipt = await account?.sendTransaction({
          to,
          value: formattedAmount,
        })
      } else {
        if (numAmount > formattedBalances[selectedToken]) {
          return toast.error('Insufficient funds.')
        }

        const transaction = prepareContractCall({
          contract: tokenContracts[selectedToken],
          method: 'transfer' as string,
          params: [to, formattedAmount],
        })

        receipt = await sendAndConfirmTransaction({
          transaction,
          account,
        })
      }

      if (receipt) {
        toast.success('Transaction sent successfully!')
        setTo('')
        setAmount('')
        setEnabled(false)
      }
    } catch (err: any) {
      console.error('Transaction error:', err)
      toast.error(err?.message || 'Transaction failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal id="send-modal-backdrop" setEnabled={setEnabled}>
      <div className="w-full max-w-md mx-auto bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl text-white overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
              <ArrowUpRightIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Send Funds</h2>
              <p className="text-gray-300 text-sm">{selectedChain.name}</p>
            </div>
          </div>
          <button
            type="button"
            className="p-2 hover:bg-white/10 rounded-full transition-colors duration-200"
            onClick={() => setEnabled(false)}
          >
            <XMarkIcon className="h-5 w-5 text-gray-300 hover:text-white" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Token Selection */}
          <div className="space-y-3">
            <label className="text-gray-300 font-medium text-sm uppercase tracking-wide">
              Select Token
            </label>
            <div className="relative">
              <select
                className="w-full bg-black/20 border border-white/10 rounded-lg p-4 text-white appearance-none cursor-pointer hover:bg-black/30 hover:border-white/20 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                value={selectedToken}
                onChange={({ target }) => setSelectedToken(target.value)}
              >
                <option value="native">{selectedNativeToken[chainSlug]}</option>
                <option value="mooney">MOONEY</option>
                <option value="dai">DAI</option>
                <option value="usdc">USDC</option>
                <option value="usdt">USDT</option>
              </select>
              <ChevronDownIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            </div>

            {/* Selected Token Display */}
            <div className="bg-black/20 rounded-lg p-4 border border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-white/5 p-1 flex items-center justify-center">
                    {selectedTokenData.icon}
                  </div>
                  <div>
                    <p className="font-medium text-white">
                      {selectedTokenData.symbol}
                    </p>
                    <p className="text-gray-400 text-xs">
                      {selectedTokenData.description}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-white">
                    {Number(balance).toLocaleString()}
                  </p>
                  <p className="text-gray-400 text-xs">Available</p>
                </div>
              </div>
            </div>
          </div>

          {/* Recipient Address */}
          <div className="space-y-3">
            <label className="text-gray-300 font-medium text-sm uppercase tracking-wide">
              Recipient Address
            </label>
            <input
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="0x..."
              className="w-full bg-black/20 border border-white/10 rounded-lg p-4 text-white placeholder-gray-400 hover:bg-black/30 hover:border-white/20 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
            />
          </div>

          {/* Amount */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-gray-300 font-medium text-sm uppercase tracking-wide">
                Amount
              </label>
              <button
                type="button"
                className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
                onClick={() => setAmount(balance.toString())}
              >
                Max: {Number(balance).toLocaleString()}
              </button>
            </div>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              step="any"
              min="0"
              className="w-full bg-black/20 border border-white/10 rounded-lg p-4 text-white placeholder-gray-400 hover:bg-black/30 hover:border-white/20 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
            />
          </div>

          {/* Send Button */}
          <button
            type="submit"
            disabled={isLoading || !to || !amount || Number(amount) <= 0}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white py-4 px-6 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 disabled:hover:scale-100 shadow-lg disabled:opacity-50"
          >
            {isLoading ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Sending...</span>
              </div>
            ) : (
              'Send Transaction'
            )}
          </button>
        </form>
      </div>
    </Modal>
  )
}

// Create a Portal component
function Portal({ children }: { children: React.ReactNode }) {
  if (typeof document === 'undefined') return null // SSR check
  return createPortal(children, document.body)
}

export function PrivyConnectWallet({
  citizenContract,
  type,
}: PrivyConnectWalletProps) {
  const router = useRouter()

  const { selectedWallet, setSelectedWallet } = useContext(PrivyWalletContext)
  const { selectedChain, setSelectedChain }: any = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)
  const [networkMistmatch, setNetworkMismatch] = useState(false)

  const account = useActiveAccount()
  const address = account?.address
  const { data: _ensData } = useENS(address)
  const ens = _ensData?.name
  const [walletChainId, setWalletChainId] = useState(1)
  const { logout, user, authenticated, connectWallet, exportWallet }: any =
    usePrivy()

  const { login } = useLogin({
    onComplete: async (user, isNewUser, wasAlreadyAuthenticated) => {
      //If the user signs in and wasn't already authenticated, check if they have a citizen NFT and redirect them to their profile or the guest page
      if (
        !wasAlreadyAuthenticated &&
        !PATHS_WITH_NO_SIGNIN_REDIRECT.includes(router.pathname)
      ) {
        let citizen
        try {
          const citizenContract = getContract({
            client,
            address: CITIZEN_ADDRESSES[chainSlug],
            chain: selectedChain,
            abi: CitizenABI as any,
          })
          const ownedTokenId = await readContract({
            contract: citizenContract,
            method: 'getOwnedToken' as string,
            params: [address],
          })
          citizen = await getNFT({
            contract: citizenContract,
            tokenId: BigInt(ownedTokenId),
          })
        } catch (err) {
          citizen = undefined
        }
        if (citizen) {
          router.push(
            `/citizen/${generatePrettyLinkWithId(
              citizen?.metadata?.name as string,
              citizen?.metadata?.id as string
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
  const [previousChain, setPreviousChain] = useState(selectedChain)

  const mooneyContract = useContract({
    address: MOONEY_ADDRESSES[chainSlug],
    chain: selectedChain,
    abi: ERC20 as any,
  })

  const daiContract = useContract({
    address: DAI_ADDRESSES[chainSlug],
    chain: selectedChain,
    abi: ERC20 as any,
  })

  const usdcContract = useContract({
    address: USDC_ADDRESSES[chainSlug],
    chain: selectedChain,
    abi: ERC20 as any,
  })

  const usdtContract = useContract({
    address: USDT_ADDRESSES[chainSlug],
    chain: selectedChain,
    abi: ERC20 as any,
  })

  const nativeBalance = useNativeBalance()

  const [formattedBalances, setFormattedBalances] = useState({
    mooney: 0,
    dai: 0,
    usdc: 0,
    usdt: 0,
  })

  const mooneyBalance = useWatchTokenBalance(MOONEY_ADDRESSES[chainSlug], 18)
  const daiBalance = useWatchTokenBalance(DAI_ADDRESSES[chainSlug], 18)
  const usdcBalance = useWatchTokenBalance(USDC_ADDRESSES[chainSlug], 6)
  const usdtBalance = useWatchTokenBalance(USDT_ADDRESSES[chainSlug], 6)

  useEffect(() => {
    if (mooneyBalance >= 0)
      setFormattedBalances((prev) => ({
        ...prev,
        mooney: Number(mooneyBalance?.toFixed(2)),
      }))
  }, [mooneyBalance])
  useEffect(() => {
    if (daiBalance)
      setFormattedBalances((prev) => ({
        ...prev,
        dai: Number(daiBalance.toFixed(2)),
      }))
  }, [daiBalance])
  useEffect(() => {
    if (usdcBalance)
      setFormattedBalances((prev) => ({
        ...prev,
        usdc: Number(usdcBalance.toFixed(2)),
      }))
  }, [usdcBalance])
  useEffect(() => {
    if (usdtBalance)
      setFormattedBalances((prev) => ({
        ...prev,
        usdt: Number(usdtBalance.toFixed(2)),
      }))
  }, [usdtBalance])

  const importToken = useImportToken(selectedChain)

  function NetworkIcon() {
    return (
      <div className="w-6 h-6 flex items-center justify-center">
        <Image
          src={`/icons/networks/${chainSlug}.svg`}
          width={20}
          height={20}
          alt="Network Icon"
          className="object-contain"
        />
      </div>
    )
  }

  function NativeTokenIcon() {
    return (
      <div className="w-6 h-6 flex items-center justify-center">
        <Image
          src={`/icons/networks/${
            chainSlug === 'polygon' ? 'polygon' : 'ethereum'
          }.svg`}
          width={20}
          height={20}
          alt="Native Token Icon"
          className="object-contain"
        />
      </div>
    )
  }

  useEffect(() => {
    if (wallets?.[0]) {
      setWalletChainId(+wallets?.[selectedWallet]?.chainId.split(':')[1])
    }
  }, [wallets, selectedWallet])

  useEffect(() => {
    const wallet = wallets[selectedWallet]
    const isAutoSwitchWallet =
      wallet?.walletClientType === 'coinbase_wallet' ||
      wallet?.walletClientType === 'privy'

    if (walletChainId !== selectedChain.id) {
      if (isAutoSwitchWallet) {
        // Add delay for auto-switching wallets to prevent flashing
        const timeout = setTimeout(() => {
          const currentWalletChainId =
            +wallets?.[selectedWallet]?.chainId?.split(':')[1]
          if (currentWalletChainId !== selectedChain.id) {
            setNetworkMismatch(true)
          }
        }, 1000)
        return () => clearTimeout(timeout)
      } else {
        setNetworkMismatch(true)
      }
    } else {
      setNetworkMismatch(false)
      setPreviousChain(selectedChain)
    }
  }, [walletChainId, selectedChain, selectedWallet, wallets])

  //detect outside click
  function handleClickOutside({ target }: any) {
    if (
      target.closest('#privy-connect-wallet-dropdown') ||
      target.closest('#privy-connect-wallet') ||
      target.closest('#privy-modal-content') ||
      target.closest('#headlessui-dialog-panel') ||
      target.closest('#send-modal-backdrop') ||
      target.closest('#network-selector')
    )
      return
    setEnabled(false)
  }
  useEffect(() => {
    if (enabled) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [enabled])

  return (
    <>
      {user && wallets?.[0] ? (
        <div className="w-full">
          <div
            id="privy-connect-wallet"
            className="cursor-pointer flex-wrap md:w-[175px] md:full relative flex flex-col items-right justify-center pl-5 pr-5 py-2 md:hover:pl-[25px] bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 font-lato z-[10] rounded-[2vmax] rounded-tl-[10px] duration-300 shadow-lg hover:shadow-xl transition-all"
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
          </div>
          
          {/* Portal dropdown to avoid clipping */}
          {enabled && createPortal(
            <div
              id="privy-connect-wallet-dropdown"
              className="fixed top-20 right-4 w-[340px] text-sm font-RobotoMono rounded-2xl animate-fadeIn p-4 md:p-6 flex flex-col bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 shadow-2xl text-white z-[9999] max-h-[80vh] overflow-y-auto scrollbar-hide"
              style={{ 
                backgroundColor: 'rgba(17, 24, 39, 0.95)'
              }}
            >
                {sendModalEnabled && (
                  <SendModal
                    account={account}
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

                {/* Header Section */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                        <WalletIcon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg text-white">
                          Wallet
                        </h3>
                        <p className="text-gray-300 text-xs">
                          {selectedChain.name}
                        </p>
                      </div>
                    </div>
                  </div>
                  <button
                    className="p-2 hover:bg-white/10 rounded-full transition-colors duration-200"
                    onClick={() => setEnabled(false)}
                  >
                    <XMarkIcon className="w-5 h-5 text-gray-300 hover:text-white" />
                  </button>
                </div>

                {/* Address Section */}
                <div className="bg-black/20 rounded-xl p-4 mb-6 border border-white/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-green-400 to-blue-500 flex items-center justify-center">
                        <div className="w-3 h-3 bg-white rounded-full"></div>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">
                          Address
                        </p>
                        <p className="text-white font-mono text-sm">
                          {`${address?.slice(0, 6)}...${address?.slice(-4)}`}
                        </p>
                      </div>
                    </div>
                    <button
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors duration-200 group"
                      onClick={() => {
                        navigator.clipboard.writeText(address || '')
                        toast.success('Address copied to clipboard.')
                      }}
                    >
                      <ClipboardDocumentIcon className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
                    </button>
                  </div>
                </div>
                {networkMistmatch ? (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                        <p className="text-red-400 font-medium">
                          Network Mismatch
                        </p>
                      </div>
                      <button
                        className="p-1 hover:bg-red-500/20 rounded-full transition-colors duration-200 group"
                        onClick={() => {
                          // Revert to previous chain
                          setSelectedChain(previousChain)
                          setNetworkMismatch(false)
                        }}
                      >
                        <XMarkIcon className="w-4 h-4 text-red-400 group-hover:text-red-300 transition-colors" />
                      </button>
                    </div>
                    <p className="text-gray-300 text-sm mb-4">
                      Your wallet is not connected to {selectedChain.name}.
                      Switch networks in your wallet or revert to{' '}
                      {previousChain.name}.
                    </p>
                    <div className="flex gap-3">
                      <button
                        className="flex-1 bg-gradient-to-r from-red-500 to-pink-500 text-white py-3 px-4 rounded-lg font-medium hover:from-red-600 hover:to-pink-600 transition-all duration-200 transform hover:scale-105"
                        onClick={() => {
                          wallets[selectedWallet].switchChain(selectedChain.id)
                        }}
                      >
                        Switch to {selectedChain.name}
                      </button>
                      <button
                        className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 px-4 rounded-lg font-medium transition-all duration-200 transform hover:scale-105"
                        onClick={() => {
                          // Revert to previous chain
                          setSelectedChain(previousChain)
                          setNetworkMismatch(false)
                        }}
                      >
                        Revert to {previousChain.name}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-gray-300 font-medium text-sm uppercase tracking-wide">
                        Balances
                      </h4>
                      <div className="flex items-center space-x-3">
                        <div className="relative w-10 h-10">
                          <NetworkSelector iconsOnly compact />
                          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 rounded-full flex items-center justify-center pointer-events-none">
                            <ChevronDownIcon className="w-2 h-2 text-white" />
                          </div>
                        </div>
                        {type === 'mobile' && (
                          <div>
                            <CitizenProfileLink />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      {/* MOONEY Balance */}
                      <div className="bg-black/20 rounded-lg p-3 border border-white/5 hover:bg-black/30 hover:border-white/10 transition-all duration-200 cursor-pointer group">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-white/5 p-1 group-hover:scale-110 transition-transform duration-200">
                              <Image
                                src="/coins/MOONEY.png"
                                width={24}
                                height={24}
                                alt="MOONEY"
                                className="rounded-full"
                              />
                            </div>
                            <div>
                              <p className="font-medium text-white group-hover:text-blue-300 transition-colors">
                                MOONEY
                              </p>
                              <p className="text-gray-400 text-xs">
                                Governance Token
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-white group-hover:text-blue-300 transition-colors">
                              {formattedBalances.mooney.toLocaleString()}
                            </p>
                            <p className="text-gray-400 text-xs">MOONEY</p>
                          </div>
                        </div>
                      </div>

                      {/* Native Token Balance */}
                      <div className="bg-black/20 rounded-lg p-3 border border-white/5 hover:bg-black/30 hover:border-white/10 transition-all duration-200 cursor-pointer group">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-white/5 p-1 group-hover:scale-110 transition-transform duration-200 flex items-center justify-center">
                              <NativeTokenIcon />
                            </div>
                            <div>
                              <p className="font-medium text-white group-hover:text-blue-300 transition-colors">
                                {selectedNativeToken[chainSlug]}
                              </p>
                              <p className="text-gray-400 text-xs">
                                Native Token
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-white group-hover:text-blue-300 transition-colors">
                              {Number(nativeBalance).toFixed(4)}
                            </p>
                            <p className="text-gray-400 text-xs">
                              {selectedNativeToken[chainSlug]}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* DAI Balance */}
                      {formattedBalances.dai > 0 && (
                        <div className="bg-black/20 rounded-lg p-3 border border-white/5 hover:bg-black/30 hover:border-white/10 transition-all duration-200 cursor-pointer group">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 rounded-full overflow-hidden bg-white/5 p-1 group-hover:scale-110 transition-transform duration-200">
                                <Image
                                  src="/coins/DAI.svg"
                                  width={24}
                                  height={24}
                                  alt="DAI"
                                />
                              </div>
                              <div>
                                <p className="font-medium text-white group-hover:text-blue-300 transition-colors">
                                  DAI
                                </p>
                                <p className="text-gray-400 text-xs">
                                  Stablecoin
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-white group-hover:text-blue-300 transition-colors">
                                {formattedBalances.dai.toLocaleString()}
                              </p>
                              <p className="text-gray-400 text-xs">DAI</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* USDC Balance */}
                      {formattedBalances.usdc > 0 && (
                        <div className="bg-black/20 rounded-lg p-3 border border-white/5 hover:bg-black/30 hover:border-white/10 transition-all duration-200 cursor-pointer group">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 rounded-full overflow-hidden bg-white/5 p-1 group-hover:scale-110 transition-transform duration-200">
                                <Image
                                  src="/coins/USDC.svg"
                                  width={24}
                                  height={24}
                                  alt="USDC"
                                />
                              </div>
                              <div>
                                <p className="font-medium text-white group-hover:text-blue-300 transition-colors">
                                  USDC
                                </p>
                                <p className="text-gray-400 text-xs">
                                  USD Coin
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-white group-hover:text-blue-300 transition-colors">
                                {formattedBalances.usdc.toLocaleString()}
                              </p>
                              <p className="text-gray-400 text-xs">USDC</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* USDT Balance */}
                      {formattedBalances.usdt > 0 && (
                        <div className="bg-black/20 rounded-lg p-3 border border-white/5 hover:bg-black/30 hover:border-white/10 transition-all duration-200 cursor-pointer group">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 rounded-full overflow-hidden bg-white/5 p-1 group-hover:scale-110 transition-transform duration-200">
                                <Image
                                  src="/coins/USDT.svg"
                                  width={24}
                                  height={24}
                                  alt="USDT"
                                />
                              </div>
                              <div>
                                <p className="font-medium text-white group-hover:text-blue-300 transition-colors">
                                  USDT
                                </p>
                                <p className="text-gray-400 text-xs">
                                  Tether USD
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-white group-hover:text-blue-300 transition-colors">
                                {formattedBalances.usdt.toLocaleString()}
                              </p>
                              <p className="text-gray-400 text-xs">USDT</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Wallet Actions */}
                <div className="mb-6">
                  <h4 className="text-gray-300 font-medium text-sm uppercase tracking-wide mb-3">
                    Quick Actions
                  </h4>
                  <div className="grid grid-cols-4 gap-2 md:gap-3">
                    <WalletAction
                      id="wallet-fund-action"
                      label="Fund"
                      icon={<PlusIcon width={20} height={20} />}
                      onClick={async () => {
                        if (!address)
                          return toast.error('Please connect your wallet.')
                        fundWallet(address, {
                          chain: viemChains[chainSlug],
                          asset: 'native-currency',
                        })
                      }}
                    />
                    <WalletAction
                      id="wallet-send-action"
                      label="Send"
                      icon={<ArrowUpRightIcon width={20} height={20} />}
                      onClick={() => {
                        setSendModalEnabled(true)
                      }}
                    />
                    <WalletAction
                      id="wallet-add-wallet-action"
                      label="Add"
                      icon={<WalletIcon width={20} height={20} />}
                      onClick={() => {
                        connectWallet()
                      }}
                    />
                    {wallets[selectedWallet]?.walletClientType === 'privy' && (
                      <WalletAction
                        id="wallet-export-action"
                        label="Export"
                        icon={<ArrowDownOnSquareIcon width={20} height={20} />}
                        onClick={() => {
                          exportWallet().catch(() => {
                            toast.error(
                              'Please select a privy wallet to export.'
                            )
                          })
                        }}
                      />
                    )}
                  </div>
                </div>

                {/* Connected Wallets */}
                <div className="mb-6">
                  <h4 className="text-gray-300 font-medium text-sm uppercase tracking-wide mb-3">
                    Connected Wallets
                  </h4>
                  <div className="space-y-2">
                    {wallets?.map((wallet, i) => (
                      <div
                        key={`wallet-${i}`}
                        className={`p-3 rounded-lg border transition-all duration-200 cursor-pointer ${
                          selectedWallet === i
                            ? 'bg-blue-500/10 border-blue-500/30 shadow-lg'
                            : 'bg-black/10 border-white/10 hover:bg-black/20'
                        }`}
                        onClick={() => setSelectedWallet(i)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div
                              className={`w-3 h-3 rounded-full ${
                                selectedWallet === i
                                  ? 'bg-blue-500'
                                  : 'bg-gray-500'
                              }`}
                            ></div>
                            <div>
                              <p className="font-medium text-white capitalize">
                                {wallet?.walletClientType}
                              </p>
                              <p className="text-gray-400 text-xs font-mono">
                                {wallet?.address.slice(0, 6)}...
                                {wallet?.address.slice(-4)}
                              </p>
                            </div>
                          </div>
                          {wallet.walletClientType !== 'metamask' &&
                            wallet.walletClientType !== 'privy' && (
                              <button
                                className="p-1 hover:bg-red-500/20 rounded text-red-400 hover:text-red-300 transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  wallet.disconnect()
                                }}
                              >
                                <XMarkIcon className="w-4 h-4" />
                              </button>
                            )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Account Management */}
                <div className="border-t border-white/10 pt-4">
                  <LinkAccounts user={user} />
                  <button
                    className="w-full mt-4 bg-gradient-to-r from-red-500/80 to-pink-500/80 hover:from-red-500 hover:to-pink-500 text-white py-3 px-4 rounded-lg font-medium transition-all duration-200 transform hover:scale-105 shadow-lg"
                    onClick={async () => {
                      wallets.forEach((wallet) => wallet.disconnect())
                      logout()
                    }}
                  >
                    <strong>Log Out</strong>
                  </button>
                </div>
              </div>,
              document.body
            )
          }
        </div>
      ) : (
        <div className="w-full">
          <button
            id="sign-in-button"
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
