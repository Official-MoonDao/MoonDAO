import {
  ArrowDownOnSquareIcon,
  ArrowUpRightIcon,
  ChevronDownIcon,
  ClipboardDocumentIcon,
  PlusIcon,
  WalletIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { useLogin, usePrivy, useWallets } from '@privy-io/react-auth'
import { COIN_ICONS } from 'const/icons'
import { ethers } from 'ethers'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import toast from 'react-hot-toast'
import useSWR from 'swr'
import { getContract, prepareContractCall, sendAndConfirmTransaction } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import { clearAllCitizenCache } from '../../lib/citizen/CitizenProvider'
import useOnrampJWT from '../../lib/coinbase/useOnrampJWT'
import { useOnrampRedirect } from '../../lib/coinbase/useOnrampRedirect'
import PrivyWalletContext from '../../lib/privy/privy-wallet-context'
import { useNativeBalance } from '../../lib/thirdweb/hooks/useNativeBalance'
import { useENS } from '../../lib/utils/hooks/useENS'
import {
  ethereum,
  arbitrum,
  base,
  polygon,
  sepolia,
  arbitrumSepolia,
  optimismSepolia,
} from '@/lib/rpc/chains'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import client from '@/lib/thirdweb/client'
import { CBOnrampModal } from '../coinbase/CBOnrampModal'
import Modal from '../layout/Modal'
import CitizenProfileLink from '../subscription/CitizenProfileLink'
import { LinkAccounts } from './LinkAccounts'
import WalletAction from './WalletAction'

// Custom hook to fetch wallet tokens from our API
function useWalletTokens(address: string | undefined, chain: string) {
  const apiKey = address
    ? `/api/etherscan/wallet-tokens?address=${address}&chain=${chain}&offset=50`
    : null

  const {
    data,
    error: swrError,
    isLoading,
    mutate,
  } = useSWR(
    apiKey,
    async (url: string) => {
      const response = await fetch(url)
      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      return data
    },
    {
      refreshInterval: 60000,
      revalidateOnFocus: false,
    }
  )

  const tokens = useMemo(() => {
    if (!data?.result) return []

    return data.result
      .filter((token: any) => token.TokenBalance && parseFloat(token.TokenBalance) > 0)
      .map((token: any) => ({
        symbol: token.TokenSymbol || 'Unknown',
        name: token.TokenName || 'Unknown Token',
        balance: token.TokenBalance,
        decimals: parseInt(token.TokenDivisor) || 18,
        contractAddress: token.TokenAddress,
        // Format balance to human readable number
        formattedBalance:
          parseFloat(token.TokenBalance) / Math.pow(10, parseInt(token.TokenDivisor) || 18),
      }))
  }, [data])

  const error = useMemo(() => {
    if (swrError) {
      return swrError instanceof Error ? swrError.message : 'Failed to fetch tokens'
    }
    if (data?.error) {
      return data.error
    }
    return null
  }, [swrError, data])

  return { tokens, loading: isLoading, error, refetch: mutate }
}

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
  account,
  selectedChain,
  networkIcon,
  setEnabled,
  nativeBalance,
  tokens,
}: any) {
  const chainSlug = getChainSlug(selectedChain)
  const [to, setTo] = useState<string>('')
  const [amount, setAmount] = useState<string>('')
  const [selectedToken, setSelectedToken] = useState<string>('native')
  const [isLoading, setIsLoading] = useState(false)

  // Local network state for SendModal
  const [sendModalChain, setSendModalChain] = useState(selectedChain)
  const [networkDropdown, setNetworkDropdown] = useState(false)

  const sendModalChainSlug = getChainSlug(sendModalChain)

  // Available chains for the network selector
  const availableChains = [
    arbitrum,
    ethereum,
    base,
    polygon,
    sepolia,
    arbitrumSepolia,
    optimismSepolia,
  ]

  // Fetch tokens for the selected network in SendModal
  const {
    tokens: modalTokens,
    loading: modalTokensLoading,
    error: modalTokensError,
  } = useWalletTokens(account?.address, sendModalChainSlug)

  // Get native balance for selected network
  const modalNativeBalance = sendModalChain.id === selectedChain.id ? nativeBalance : 0

  // Create a combined list of native + ERC-20 tokens
  const allTokens = useMemo(() => {
    const nativeToken = {
      TokenAddress: 'native',
      TokenSymbol: selectedNativeToken[sendModalChainSlug],
      TokenName: 'Native Token',
      TokenBalance: modalNativeBalance?.toString() || '0',
      TokenDivisor: '18',
    }

    // Convert walletTokens format to SendModal format
    const formattedTokens = Array.isArray(modalTokens)
      ? modalTokens.map((token) => ({
          TokenAddress: token.contractAddress,
          TokenSymbol: token.symbol,
          TokenName: token.name,
          TokenBalance: token.balance, // This is already the raw balance from API
          TokenDivisor: token.decimals.toString(),
        }))
      : []

    return [nativeToken, ...formattedTokens]
  }, [modalTokens, modalNativeBalance, sendModalChainSlug])

  // Reset selected token when network changes
  useEffect(() => {
    setSelectedToken('native')
    setAmount('')
  }, [sendModalChain.id])

  // Close network dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Element
      if (!target.closest('.network-dropdown-container')) {
        setNetworkDropdown(false)
      }
    }

    if (networkDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [networkDropdown])

  // Get the currently selected token data
  const selectedTokenData = useMemo(() => {
    return allTokens.find(
      (token) =>
        token.TokenAddress === selectedToken ||
        (selectedToken === 'native' && token.TokenAddress === 'native')
    )
  }, [selectedToken, allTokens])

  // Calculate formatted balance for display
  // Get the formatted balance for display
  const formattedBalance = useMemo(() => {
    if (!selectedTokenData) return 0
    const balance = selectedTokenData.TokenBalance
    const decimals = parseInt(selectedTokenData.TokenDivisor)

    // Check if balance is already a decimal number (like "0.3157975")
    if (balance.includes('.')) {
      return Number(balance)
    }

    // Otherwise, it's a raw wei value that needs formatting
    try {
      return Number(ethers.utils.formatUnits(balance, decimals))
    } catch (error) {
      console.error('Error formatting balance:', error, balance)
      return 0
    }
  }, [selectedTokenData])

  const getTokenIcon = useCallback(
    (symbol: string) => {
      if (symbol in COIN_ICONS) {
        return (
          <Image
            src={COIN_ICONS[symbol as keyof typeof COIN_ICONS]}
            width={24}
            height={24}
            alt={symbol}
            className={symbol === 'MOONEY' ? 'rounded-full' : ''}
          />
        )
      }
      return (
        <div className="relative flex mt-2 sm:mt-0 gap-2 items-center sm:bg-[#111C42] rounded-full p-1 sm:px-2">
          <Image
            src="/assets/icon-star.svg"
            alt="Token"
            width={20}
            height={20}
            className="bg-orange-500 rounded-full p-1 w-5 h-5"
          />
        </div>
      )
    },
    [sendModalChainSlug, networkIcon]
  )

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

      if (!selectedTokenData) {
        return toast.error('Invalid token selected.')
      }

      const numAmount = Number(amount)
      if (numAmount > formattedBalance) {
        return toast.error('Insufficient funds.')
      }

      const decimals = parseInt(selectedTokenData.TokenDivisor)
      const formattedAmount = ethers.utils.parseUnits(amount.toString(), decimals)

      let receipt
      if (selectedToken === 'native') {
        // Send native token (ETH, MATIC, etc.)
        receipt = await account?.sendTransaction({
          to,
          value: BigInt(formattedAmount.toString()),
        })
      } else {
        // Send ERC-20 token using generic contract interface
        const contract = getContract({
          client,
          address: selectedTokenData.TokenAddress,
          chain: sendModalChain,
          abi: [
            {
              name: 'transfer',
              type: 'function',
              stateMutability: 'nonpayable',
              inputs: [
                { name: 'to', type: 'address' },
                { name: 'amount', type: 'uint256' },
              ],
              outputs: [{ name: '', type: 'bool' }],
            },
          ],
        })

        const transaction = prepareContractCall({
          contract,
          method: 'transfer',
          params: [to, BigInt(formattedAmount.toString())],
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
          {/* Network Selection */}
          <div className="space-y-3 network-dropdown-container">
            <label className="text-gray-300 font-medium text-sm uppercase tracking-wide">
              Network
            </label>
            <div className="relative">
              <div
                className="w-full bg-black/20 border border-white/10 rounded-lg p-4 text-white cursor-pointer hover:bg-black/30 hover:border-white/20 transition-all duration-200 flex items-center justify-between"
                onClick={() => setNetworkDropdown(!networkDropdown)}
              >
                <div className="flex items-center space-x-3">
                  <Image
                    src={`/icons/networks/${sendModalChainSlug}.svg`}
                    width={20}
                    height={20}
                    alt={sendModalChain.name || 'Network'}
                    className="object-contain"
                  />
                  <span className="font-medium">{sendModalChain.name || 'Unknown Network'}</span>
                </div>
                <ChevronDownIcon
                  className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                    networkDropdown ? 'rotate-180' : ''
                  }`}
                />
              </div>

              {networkDropdown && (
                <div className="absolute top-full mt-2 w-full bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl z-[10000] max-h-48 overflow-y-auto">
                  {availableChains.map((chain) => (
                    <button
                      key={chain.id}
                      type="button"
                      className="w-full flex items-center space-x-3 p-3 hover:bg-white/10 transition-colors duration-200 text-left first:rounded-t-lg last:rounded-b-lg"
                      onClick={() => {
                        setSendModalChain(chain)
                        setNetworkDropdown(false)
                      }}
                    >
                      <Image
                        src={`/icons/networks/${getChainSlug(chain)}.svg`}
                        width={20}
                        height={20}
                        alt={chain.name || 'Chain'}
                        className="object-contain"
                      />
                      <span className="font-medium text-white">
                        {chain.name || 'Unknown Network'}
                        <span className="text-gray-400 text-xs font-medium uppercase tracking-wide">
                          {chain === arbitrum ? '(Recommended)' : ''}
                        </span>
                      </span>
                      {chain.id === sendModalChain.id && (
                        <div className="ml-auto w-2 h-2 bg-blue-500 rounded-full"></div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

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
                {allTokens.map((token) => (
                  <option key={token.TokenAddress} value={token.TokenAddress}>
                    {token.TokenSymbol}
                    {token.TokenAddress !== 'native' &&
                      ` (${token.TokenAddress.slice(0, 6)}...${token.TokenAddress.slice(-4)})`}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            </div>

            {/* Loading state for tokens */}
            {modalTokensLoading && (
              <div className="bg-black/10 rounded-lg p-3 border border-white/5">
                <div className="flex items-center justify-center space-x-2 text-gray-400">
                  <div className="w-4 h-4 border-2 border-gray-400/30 border-t-gray-400 rounded-full animate-spin"></div>
                  <span className="text-sm">
                    Loading tokens for {sendModalChain.name || 'selected network'}...
                  </span>
                </div>
              </div>
            )}

            {/* Error state for tokens */}
            {modalTokensError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <p className="text-red-400 text-sm">{modalTokensError}</p>
              </div>
            )}

            {/* Selected Token Display */}
            {selectedTokenData && (
              <div className="bg-black/20 rounded-lg p-4 border border-white/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-white/5 p-1 flex items-center justify-center">
                      {getTokenIcon(selectedTokenData.TokenSymbol)}
                    </div>
                    <div>
                      <p className="font-medium text-white">{selectedTokenData.TokenSymbol}</p>
                      <p className="text-gray-400 text-xs">
                        {selectedTokenData.TokenName}
                        {selectedTokenData.TokenAddress !== 'native' && (
                          <span className="block font-mono text-xs">
                            {selectedTokenData.TokenAddress.slice(0, 6)}...
                            {selectedTokenData.TokenAddress.slice(-4)}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-white">
                      {formattedBalance.toLocaleString(undefined, {
                        maximumFractionDigits: 6,
                      })}
                    </p>
                    <p className="text-gray-400 text-xs">Available</p>
                  </div>
                </div>
              </div>
            )}
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
                onClick={() => setAmount(formattedBalance.toString())}
              >
                Max:{' '}
                {formattedBalance.toLocaleString(undefined, {
                  maximumFractionDigits: 6,
                })}
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

export function PrivyConnectWallet({ citizenContract, type }: PrivyConnectWalletProps) {
  const router = useRouter()

  const { selectedWallet, setSelectedWallet } = useContext(PrivyWalletContext)
  const { selectedChain, setSelectedChain }: any = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)
  const [networkMistmatch, setNetworkMismatch] = useState(false)
  const [networkDropdownOpen, setNetworkDropdownOpen] = useState(false)

  const account = useActiveAccount()
  const address = account?.address
  const { data: _ensData } = useENS(address)
  const ens = _ensData?.name
  const [walletChainId, setWalletChainId] = useState(1)
  const { logout, user, authenticated, connectWallet, exportWallet }: any = usePrivy()

  // Available chains for the network selector
  const availableChains = [
    arbitrum,
    ethereum,
    base,
    polygon,
    sepolia,
    arbitrumSepolia,
    optimismSepolia,
  ]

  const { login } = useLogin()
  const { wallets } = useWallets()

  const [enabled, setEnabled] = useState(false)
  const [sendModalEnabled, setSendModalEnabled] = useState(false)
  const [onrampModalOpen, setOnrampModalOpen] = useState(false)
  const [previousChain, setPreviousChain] = useState(selectedChain)

  const { nativeBalance, refetch: refetchNativeBalance } = useNativeBalance()
  const { isReturningFromOnramp, clearRedirectParams } = useOnrampRedirect()
  const { verifyJWT, getStoredJWT, clearJWT } = useOnrampJWT()

  // Handle redirect return - verify JWT, refresh balance and show success
  useEffect(() => {
    if (isReturningFromOnramp && address) {
      // Verify JWT before proceeding
      const storedJWT = getStoredJWT()
      if (!storedJWT) {
        // No JWT - clear redirect params
        clearRedirectParams()
        return
      }

      const chainSlug = getChainSlug(selectedChain)
      verifyJWT(storedJWT, address, undefined, 'wallet').then((payload) => {
        if (
          !payload ||
          payload.address.toLowerCase() !== address.toLowerCase() ||
          payload.chainSlug !== chainSlug ||
          payload.context !== 'wallet'
        ) {
          // Invalid JWT - clear and exit
          clearJWT()
          clearRedirectParams()
          return
        }

        // JWT valid - refresh balance and show success
        clearRedirectParams()
        clearJWT() // Clear JWT after verification
        setTimeout(async () => {
          await refetchNativeBalance()
          toast.success('Purchase completed successfully!')
        }, 1000)
      })
    }
  }, [
    isReturningFromOnramp,
    address,
    clearRedirectParams,
    refetchNativeBalance,
    getStoredJWT,
    verifyJWT,
    clearJWT,
    selectedChain,
  ])

  const {
    tokens: walletTokens,
    loading: tokensLoading,
    error: tokensError,
  } = useWalletTokens(address, chainSlug)

  // Helper function to map chain to Coinbase supported network
  const getNetworkName = (chain: any) => {
    const chainName = chain?.name?.toLowerCase() || 'ethereum'
    const chainId = chain?.id

    switch (chainName) {
      case 'arbitrum':
      case 'arbitrum one':
        return 'arbitrum'
      case 'arbitrum sepolia':
        return 'arbitrum'
      case 'base':
        return 'base'
      case 'base sepolia':
        return 'base'
      case 'sepolia':
      case 'ethereum':
      case 'mainnet':
        return 'ethereum'
      case 'optimism':
        return 'optimism'
      case 'optimism sepolia':
        return 'optimism'
      case 'polygon':
        return 'polygon'
      default:
        switch (chainId) {
          case 11155111: // Sepolia
            return 'ethereum'
          case 421614: // Arbitrum Sepolia
            return 'arbitrum'
          case 84532: // Base Sepolia
            return 'base'
          case 11155420: // Optimism Sepolia
            return 'optimism'
          default:
            return 'ethereum'
        }
    }
  }

  const openCoinbaseOnramp = () => {
    if (!address) {
      return toast.error('Please connect your wallet.')
    }
    setOnrampModalOpen(true)
  }

  // Helper function to get token icon
  const getTokenIcon = (symbol: string, contractAddress: string) => {
    const symbolLower = symbol.toLowerCase()

    // Check for known tokens first
    if (symbolLower === 'mooney') {
      return (
        <Image
          src="/coins/MOONEY.png"
          width={24}
          height={24}
          alt={symbol}
          className="rounded-full"
        />
      )
    }
    if (symbolLower === 'dai') {
      return <Image src="/coins/DAI.svg" width={24} height={24} alt={symbol} />
    }
    if (symbolLower === 'usdc') {
      return <Image src="/coins/USDC.svg" width={24} height={24} alt={symbol} />
    }
    if (symbolLower === 'usdt') {
      return <Image src="/coins/USDT.svg" width={24} height={24} alt={symbol} />
    }

    // Fallback to a generic token icon or first letter
    return (
      <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
        {symbol.charAt(0).toUpperCase()}
      </div>
    )
  }

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
          src={`/icons/networks/${chainSlug === 'polygon' ? 'polygon' : 'ethereum'}.svg`}
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
      wallet?.walletClientType === 'coinbase_wallet' || wallet?.walletClientType === 'privy'

    if (walletChainId !== selectedChain.id) {
      if (isAutoSwitchWallet) {
        // Add delay for auto-switching wallets to prevent flashing
        const timeout = setTimeout(() => {
          const currentWalletChainId = +wallets?.[selectedWallet]?.chainId?.split(':')[1]
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
      target.closest('.network-dropdown-container')
    )
      return
    setEnabled(false)
    setNetworkDropdownOpen(false)
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
            className="cursor-pointer flex-wrap md:w-[175px] md:full relative flex flex-col items-right justify-center px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 font-lato z-[10] rounded-full duration-300 shadow-lg hover:shadow-xl transition-colors"
            onClick={(e: any) => {
              setEnabled(!enabled)
            }}
          >
            {/*Address and Toggle open/close button*/}
            <div className="flex items-center w-full h-full justify-between">
              <p className="text-xs">
                {ens ? ens : address ? `${address?.slice(0, 6)}...${address?.slice(-4)}` : ''}
              </p>
              <ChevronDownIcon
                className={`w-4 h-4 text-black dark:text-white cursor-pointer transition-all duration-150 ${
                  enabled ? 'rotate-180' : ''
                }`}
              />
            </div>
          </div>

          {/* Portal dropdown to avoid clipping */}
          {enabled &&
            createPortal(
              <div
                id="privy-connect-wallet-dropdown"
                className="fixed top-20 right-4 w-[340px] text-sm font-RobotoMono rounded-2xl animate-fadeIn p-4 md:p-6 flex flex-col bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 shadow-2xl text-white z-[9999] max-h-[80vh] overflow-y-auto scrollbar-hide"
                style={{
                  backgroundColor: 'rgba(17, 24, 39, 0.95)',
                }}
              >
                {sendModalEnabled && (
                  <SendModal
                    account={account}
                    selectedChain={selectedChain}
                    setEnabled={setSendModalEnabled}
                    networkIcon={<NetworkIcon />}
                    nativeBalance={nativeBalance}
                    tokens={walletTokens}
                  />
                )}

                {/* Header Section */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                      <WalletIcon className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="font-semibold text-lg text-white">Wallet</h3>
                  </div>
                  <button
                    className="p-2 hover:bg-white/10 rounded-full transition-colors duration-200"
                    onClick={() => setEnabled(false)}
                  >
                    <XMarkIcon className="w-5 h-5 text-gray-300 hover:text-white" />
                  </button>
                </div>

                {/* Address Section - Compact */}
                <div className="bg-black/20 rounded-lg p-3 mb-4 border border-white/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-r from-green-400 to-blue-500 flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      </div>
                      <p className="text-white font-mono text-sm">
                        {`${address?.slice(0, 6)}...${address?.slice(-4)}`}
                      </p>
                    </div>
                    <button
                      className="p-1 hover:bg-white/10 rounded transition-colors duration-200 group"
                      onClick={() => {
                        navigator.clipboard.writeText(address || '')
                        toast.success('Address copied to clipboard.')
                      }}
                    >
                      <ClipboardDocumentIcon className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
                    </button>
                  </div>
                </div>

                {/* Network Selection */}
                <div className="network-dropdown-container relative">
                  <div
                    className="bg-black/20 rounded-xl p-4 mb-6 border border-white/5 hover:bg-black/30 hover:border-white/10 transition-all duration-200 cursor-pointer group"
                    onClick={() => setNetworkDropdownOpen(!networkDropdownOpen)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-white/5 p-1 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                          <Image
                            src={`/icons/networks/${chainSlug}.svg`}
                            width={20}
                            height={20}
                            alt="Network Icon"
                            className="object-contain"
                          />
                        </div>
                        <div>
                          <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">
                            Network
                          </p>
                          <span className="text-white font-medium group-hover:text-blue-300 transition-colors">
                            {selectedChain.name}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <ChevronDownIcon
                          className={`w-5 h-5 text-gray-400 group-hover:text-white transition-all duration-200 ${
                            networkDropdownOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Custom Network Dropdown */}
                  {networkDropdownOpen && (
                    <div className="absolute top-full -mt-6 w-full bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl z-[10000] max-h-48 overflow-y-auto">
                      {availableChains.map((chain) => (
                        <button
                          key={chain.id}
                          type="button"
                          className="w-full flex items-center space-x-3 p-3 hover:bg-white/10 transition-colors duration-200 text-left first:rounded-t-lg last:rounded-b-lg min-h-[48px]"
                          onClick={() => {
                            setSelectedChain(chain)
                            setNetworkDropdownOpen(false)
                          }}
                        >
                          <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                            <Image
                              src={`/icons/networks/${getChainSlug(chain)}.svg`}
                              width={20}
                              height={20}
                              alt={chain.name || 'Chain'}
                              className="object-contain w-full h-full"
                            />
                          </div>
                          <span className="font-medium text-white flex-1">
                            {chain.name || 'Unknown Network'}
                            <span className="ml-2 text-gray-400 text-xs font-medium uppercase tracking-wide">
                              {chain === arbitrum ? '(Recommended)' : ''}
                            </span>
                          </span>
                          {chain.id === selectedChain.id && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {networkMistmatch ? (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                        <p className="text-red-400 font-medium">Network Mismatch</p>
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
                      Your wallet is not connected to {selectedChain.name}. Switch networks in your
                      wallet or revert to {previousChain.name}.
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
                      {type === 'mobile' && (
                        <div>
                          <CitizenProfileLink />
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 max-h-60 overflow-y-auto scrollbar-hide pr-1">
                      {/* Native Token Balance - Always show first */}
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
                              <p className="text-gray-400 text-xs">Native Token</p>
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

                      {/* Loading State */}
                      {tokensLoading && (
                        <div className="bg-black/20 rounded-lg p-3 border border-white/5">
                          <div className="flex items-center justify-center space-x-2 text-gray-400">
                            <div className="w-4 h-4 border-2 border-gray-400/30 border-t-gray-400 rounded-full animate-spin"></div>
                            <span className="text-sm">Loading tokens...</span>
                          </div>
                        </div>
                      )}

                      {/* Error State */}
                      {tokensError && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                          <p className="text-red-400 text-sm">{tokensError}</p>
                        </div>
                      )}

                      {/* Dynamic Token Balances */}
                      {walletTokens.map((token: any, index: number) => (
                        <div
                          key={`${token.contractAddress}-${index}`}
                          className="bg-black/20 rounded-lg p-3 border border-white/5 hover:bg-black/30 hover:border-white/10 transition-all duration-200 cursor-pointer group"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 rounded-full overflow-hidden bg-white/5 p-1 group-hover:scale-110 transition-transform duration-200 flex items-center justify-center">
                                {getTokenIcon(token.symbol, token.contractAddress)}
                              </div>
                              <div>
                                <p className="font-medium text-white group-hover:text-blue-300 transition-colors">
                                  {token.symbol}
                                </p>
                                <p className="text-gray-400 text-xs">{token.name}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-white group-hover:text-blue-300 transition-colors">
                                {token.formattedBalance < 0.01
                                  ? token.formattedBalance.toExponential(2)
                                  : token.formattedBalance.toLocaleString(undefined, {
                                      minimumFractionDigits: 0,
                                      maximumFractionDigits: 6,
                                    })}
                              </p>
                              <p className="text-gray-400 text-xs">{token.symbol}</p>
                            </div>
                          </div>
                        </div>
                      ))}
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
                      onClick={openCoinbaseOnramp}
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
                            toast.error('Please select a privy wallet to export.')
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
                                selectedWallet === i ? 'bg-blue-500' : 'bg-gray-500'
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
                      clearAllCitizenCache()
                      logout()
                    }}
                  >
                    <strong>Log Out</strong>
                  </button>
                </div>
              </div>,
              document.body
            )}
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
            className="text-[12px] md:text-[18px] rounded-full px-4 py-1 gradient-2 transition-colors duration-150"
          >
            <div className="flex items-center justify-center">
              <Image
                src="/assets/icon-user.svg"
                alt="Sign in with your wallet"
                width="20"
                height="20"
              ></Image>
              <p className="pl-2">Sign in</p>
            </div>
          </button>
        </div>
      )}
      {address && (
        <CBOnrampModal
          enabled={onrampModalOpen}
          setEnabled={setOnrampModalOpen}
          address={address}
          selectedChain={selectedChain}
          ethAmount={0}
          allowAmountInput={true}
          context="wallet"
        />
      )}
    </>
  )
}
