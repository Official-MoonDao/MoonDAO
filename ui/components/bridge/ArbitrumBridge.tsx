import { getL2Network, EthBridger, Erc20Bridger } from '@arbitrum/sdk'
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react'
import { ChevronUpDownIcon } from '@heroicons/react/24/outline'
import { useWallets } from '@privy-io/react-auth'
import ERC20ABI from 'const/abis/ERC20.json'
import { ethers } from 'ethers'
import Image from 'next/image'
import { useContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { getContract, readContract } from 'thirdweb'
import { useActiveAccount, useActiveWallet } from 'thirdweb/react'
import { EIP1193 } from 'thirdweb/wallets'
import { getWalletEthersProvider } from '../../lib/privy/getWalletEthersProvider'
import PrivyWalletContext from '../../lib/privy/privy-wallet-context'
import {
  BRIDGE_TOKENS,
  BridgeTokenId,
  bridgeTokenById,
  buildUsdcBurnCall,
  CctpFeeTier,
  fetchUsdcBridgeFee,
  formatUsdcUnits,
  parseUsdcUnits,
  quoteUsdcForwardBurn,
  USDC_BURN_WITH_HOOK_ABI,
} from '@/lib/bridge/usdcCctp'
import { arbitrum, ethereum } from '@/lib/rpc/chains'
import { useGasPrice } from '@/lib/rpc/useGasPrice'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import client from '@/lib/thirdweb/client'
import { CCTP_V2, MOONEY_ADDRESSES, USDC_ADDRESSES, USDC_DECIMALS } from '../../const/config'
import Input from '../layout/Input'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'

export default function ArbitrumBridge() {
  const account = useActiveAccount()
  const wallet = useActiveWallet()
  const address = account?.address
  const { selectedChain, setSelectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()
  const [amount, setAmount] = useState<any>(0)
  const [inputToken, setInputToken] = useState<BridgeTokenId>('mooney')
  const bridgeType = 'deposit'
  const [nativeBalance, setNativeBalance] = useState<any>(0)
  const [ethMooneyBalance, setEthMooneyBalance] = useState<any>()
  const [ethUsdcBalance, setEthUsdcBalance] = useState<string>('0')
  const [usdcFeeTier, setUsdcFeeTier] = useState<CctpFeeTier | null>(null)
  const [usdcFeeError, setUsdcFeeError] = useState(false)
  const [isEOA, setIsEOA] = useState(false)
  const [arbMooneyBalance, setArbMooneyBalance] = useState<any>()
  const [balance, setBalance] = useState(0)
  const [skipNetworkCheck, setSkipNetworkCheck] = useState(false)
  const { effectiveGasPrice, maxFeePerGas } = useGasPrice(ethereum)

  async function approveMooney(signer: any, erc20Bridger: any) {
    const mooneyContract = getContract({
      client,
      address: MOONEY_ADDRESSES['ethereum'],
      abi: ERC20ABI as any,
      chain: ethereum,
    })
    const allowance = await readContract({
      contract: mooneyContract,
      method: 'allowance',
      params: [wallets[selectedWallet]?.address, '0xa3A7B6F88361F48403514059F1F16C8E78d60EeC'],
    })

    if (ethers.utils.parseEther(amount).gt(allowance)) {
      //approve mooney
      const approveTx = await erc20Bridger.approveToken({
        l1Signer: signer,
        erc20L1Address: MOONEY_ADDRESSES['ethereum'],
      })
      const approveReceipt = await approveTx.wait()
      toast.success('Approved MOONEY.')
      return approveReceipt
    }
  }

  async function depositEth() {
    const l2Network = await getL2Network(arbitrum.id)
    const ethBridger = new EthBridger(l2Network)
    const provider = await getWalletEthersProvider(wallets[selectedWallet])
    const signer = provider.getSigner()
    const depositTx = await ethBridger.deposit({
      amount: ethers.utils.parseEther(amount),
      l1Signer: signer,
    })
    const depositReceipt = await depositTx.wait()
    toast.success('Your ETH has been bridged to Arbitrum. Please wait up to 15 minutes.', {
      duration: 10000,
    })
    return depositReceipt
  }

  useEffect(() => {
    async function checkIsEOA() {
      const provider = await getWalletEthersProvider(wallets[selectedWallet])
      // Get the code at the given address
      if (provider && address) {
        const code = await provider.getCode(address)
        // An EOA will have an empty code (0x)
        setIsEOA(code === '0x')
      }
    }
    checkIsEOA()
  }, [address, wallets])

  async function withdrawEth() {
    const l2Network = await getL2Network(arbitrum.id)
    const ethBridger = new EthBridger(l2Network)
    const provider = await getWalletEthersProvider(wallets[selectedWallet])
    const signer = provider.getSigner()
    const withdrawTx = await ethBridger.withdraw({
      amount: ethers.utils.parseEther(amount),
      l2Signer: signer,
      destinationAddress: wallets[selectedWallet]?.address,
      from: wallets[selectedWallet]?.address,
    })
    const withdrawReceipt = await withdrawTx.wait()
    toast.success('Your ETH has been withdrawn from Arbitrum. Please wait up to 7 days.', {
      duration: 10000,
    })
    return withdrawReceipt
  }
  async function depositMooney() {
    if (!wallet) return
    const l2Network = await getL2Network(arbitrum.id)
    const erc20Bridger = new Erc20Bridger(l2Network)
    const provider = await getWalletEthersProvider(wallets[selectedWallet])
    const signer = provider.getSigner()
    const l2Provider = new ethers.providers.JsonRpcProvider(
      `https://42161.rpc.thirdweb.com/${process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID}`
    )
    //get allowance
    await approveMooney(signer, erc20Bridger)
    //deposit mooney
    const depositTx = await erc20Bridger.deposit({
      amount: ethers.utils.parseEther(amount),
      erc20L1Address: MOONEY_ADDRESSES['ethereum'],
      l1Signer: signer,
      l2Provider,
    })
    const depositReceipt = await depositTx.wait()
    toast.success('Your MOONEY has been bridged to Arbitrum. Please wait up to 15 minutes.', {
      duration: 10000,
    })
    return depositReceipt
  }
  async function withdrawMooney() {
    const l2Network = await getL2Network(arbitrum.id)
    const erc20Bridger = new Erc20Bridger(l2Network)
    const provider = await getWalletEthersProvider(wallets[selectedWallet])
    const signer = provider.getSigner()

    //withdraw mooney
    const withdrawTx = await erc20Bridger.withdraw({
      amount: ethers.utils.parseEther(amount),
      destinationAddress: wallets[selectedWallet]?.address,
      erc20l1Address: MOONEY_ADDRESSES['ethereum'],
      l2Signer: signer,
    })
    const withdrawReceipt = await withdrawTx.wait()
    toast.success('Your MOONEY has been withdrawn from Arbitrum. Please wait up to 7 days.', {
      duration: 10000,
    })
    return withdrawReceipt
  }

  async function depositUsdc() {
    const payAmount = parseUsdcUnits(String(amount))
    if (payAmount === null || payAmount <= 0n) {
      toast.error('Enter a USDC amount.')
      return
    }
    const tier = await fetchUsdcBridgeFee()
    setUsdcFeeTier(tier)
    setUsdcFeeError(false)
    const quote = quoteUsdcForwardBurn(payAmount, tier)
    if (!quote) {
      toast.error('Amount is below the USDC bridge fee.')
      return
    }

    const provider = await getWalletEthersProvider(wallets[selectedWallet])
    const signer = provider.getSigner()
    const recipient = await signer.getAddress()
    const usdc = new ethers.Contract(USDC_ADDRESSES.ethereum, ERC20ABI, signer)
    const allowance = await usdc.allowance(recipient, CCTP_V2.tokenMessenger)
    if (allowance.lt(quote.payAmount.toString())) {
      const approveTx = await usdc.approve(CCTP_V2.tokenMessenger, quote.payAmount.toString())
      await approveTx.wait()
      toast.success('Approved USDC.')
    }

    const call = buildUsdcBurnCall({
      payAmount: quote.payAmount,
      maxFee: quote.maxFee,
      recipient,
    })
    const messenger = new ethers.Contract(call.tokenMessenger, USDC_BURN_WITH_HOOK_ABI, signer)
    const burnTx = await messenger.depositForBurnWithHook(...call.args)
    await burnTx.wait()
    toast.success(
      'Your USDC is bridging to Arbitrum. Native USDC should arrive in a few minutes.',
      { duration: 10000 }
    )
    return burnTx
  }

  async function temporarilySkipNetworkCheck() {
    setSkipNetworkCheck(true)
    setTimeout(() => {
      setSkipNetworkCheck(false)
    }, 100)
  }

  function TokenSymbol({
    token = inputToken,
    className,
  }: {
    token?: BridgeTokenId
    className?: string
  }) {
    const meta = bridgeTokenById(token)
    return <Image src={meta.icon} width={20} height={20} alt="" className={className} />
  }

  useEffect(() => {
    async function getEthMooneyBalance() {
      const mooneyContract = getContract({
        client,
        address: MOONEY_ADDRESSES['ethereum'],
        abi: ERC20ABI as any,
        chain: ethereum,
      })
      try {
        const balance = await readContract({
          contract: mooneyContract,
          method: 'balanceOf',
          params: [address],
        })
        setEthMooneyBalance(ethers.utils.formatEther(balance.toString()))
      } catch (err) {
        console.error(err)
      }
    }
    async function getArbMooneyBalance() {
      const mooneyContract = getContract({
        client,
        address: MOONEY_ADDRESSES['arbitrum'],
        abi: ERC20ABI as any,
        chain: arbitrum,
      })
      try {
        const balance = await readContract({
          contract: mooneyContract,
          method: 'balanceOf',
          params: [address],
        })
        setArbMooneyBalance(ethers.utils.formatEther(balance.toString()))
      } catch (err) {
        console.error(err)
      }
    }
    async function getEthUsdcBalance() {
      const usdcContract = getContract({
        client,
        address: USDC_ADDRESSES.ethereum,
        abi: ERC20ABI as any,
        chain: ethereum,
      })
      try {
        const balance = await readContract({
          contract: usdcContract,
          method: 'balanceOf',
          params: [address],
        })
        setEthUsdcBalance(ethers.utils.formatUnits(balance.toString(), USDC_DECIMALS))
      } catch (err) {
        console.error(err)
      }
    }

    if (address) {
      getEthMooneyBalance()
      getArbMooneyBalance()
      getEthUsdcBalance()
    }
  }, [address, selectedChain])

  useEffect(() => {
    async function getEthBalance() {
      if (!wallet) return
      const provider = EIP1193.toProvider({
        wallet,
        chain: ethereum,
        client,
      })
      try {
        const balanceHex = await provider.request({
          method: 'eth_getBalance',
          params: [address, 'latest'],
        })
        const balance = ethers.utils.formatEther(balanceHex)
        setNativeBalance(balance)
      } catch (err) {
        console.error(err)
      }
    }

    if (address) {
      getEthBalance()
    }
  }, [address, wallets, inputToken])

  useEffect(() => {
    if (inputToken === 'eth') {
      setBalance(nativeBalance)
    } else if (inputToken === 'mooney') {
      setBalance(ethMooneyBalance)
    } else if (inputToken === 'usdc') {
      setBalance(ethUsdcBalance)
    }
  }, [ethMooneyBalance, ethUsdcBalance, nativeBalance, inputToken])

  useEffect(() => {
    temporarilySkipNetworkCheck()
    setSelectedChain(ethereum)
  }, [setSelectedChain])

  useEffect(() => {
    if (inputToken !== 'usdc') return
    let cancelled = false
    fetchUsdcBridgeFee()
      .then((tier) => {
        if (cancelled) return
        setUsdcFeeTier(tier)
        setUsdcFeeError(false)
      })
      .catch(() => {
        if (cancelled) return
        setUsdcFeeError(true)
      })
    return () => {
      cancelled = true
    }
  }, [inputToken])

  const numAmount = parseFloat(String(amount)) || 0
  // For ETH, reserve L1 gas so a (near-)full-balance entry doesn't revert the
  // deposit on fees. MOONEY and USDC gas is paid separately in ETH, so they need no reserve.
  //
  // EIP-1559 wallets lock up maxFeePerGas * gasLimit upfront (not effectiveGasPrice),
  // so we must use maxFeePerGas here. The Arbitrum deposit also runs ~300k gas, not
  // 200k, so we use that larger estimate to avoid "insufficient funds" on MAX.
  const gasPriceForReserve =
    maxFeePerGas && maxFeePerGas > BigInt(0) ? maxFeePerGas : effectiveGasPrice
  const gasReserveEth =
    gasPriceForReserve > BigInt(0) ? Number(gasPriceForReserve * BigInt(300000)) / 1e18 : 0.004
  const spendableBalance =
    inputToken === 'eth' ? Math.max(0, Number(balance) - gasReserveEth) : Number(balance)
  const isOverBalance = balance !== undefined && numAmount > 0 && numAmount > spendableBalance
  const selectedToken = bridgeTokenById(inputToken)
  const tokenLabel = selectedToken.label
  const usdcPayUnits = inputToken === 'usdc' ? parseUsdcUnits(String(amount)) : null
  const usdcQuote =
    inputToken === 'usdc' && usdcFeeTier && usdcPayUnits !== null
      ? quoteUsdcForwardBurn(usdcPayUnits, usdcFeeTier)
      : null
  const usdcBlocked =
    inputToken === 'usdc' && numAmount > 0 && (usdcFeeError || !usdcFeeTier || !usdcQuote)
  const bridgeLabel =
    numAmount === 0
      ? 'Enter Amount'
      : isOverBalance
      ? `Not Enough ${tokenLabel}`
      : inputToken === 'usdc' && usdcFeeError
      ? 'Bridge fee unavailable'
      : inputToken === 'usdc' && !usdcFeeTier
      ? 'Loading bridge fee'
      : inputToken === 'usdc' && !usdcQuote
      ? 'Amount below bridge fee'
      : 'Bridge to Arbitrum'
  const receiveText =
    inputToken === 'usdc'
      ? usdcQuote
        ? formatUsdcUnits(usdcQuote.receiveAmount)
        : numAmount > 0
        ? '…'
        : '0.0'
      : !amount
      ? '0.0'
      : String(amount).endsWith('.')
      ? (parseFloat(amount) || 0).toLocaleString('en-US', { maximumFractionDigits: 18 }) + '.'
      : (parseFloat(amount) || 0).toLocaleString('en-US', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 18,
        })

  return (
    <div className="w-full mt-3 sm:mt-4">
      <div className="text-sm font-RobotoMono rounded-xl sm:rounded-2xl animate-fadeIn p-3 sm:p-4 flex flex-col bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 shadow-2xl text-white">
        {/* Bridge Interface - Consistent with get-mooney */}
        <div className="space-y-2 sm:space-y-3 mb-3 sm:mb-4">
          <div className="grid grid-cols-1 gap-2 sm:gap-3">
            {/* You Pay */}
            <div className="bg-black/20 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-white/5 hover:bg-black/30 hover:border-white/10 transition-all duration-200 min-h-[88px] sm:min-h-[96px] flex flex-col justify-between focus-within:border-blue-400/50">
              <div className="flex items-center justify-between gap-2 sm:gap-3">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0 overflow-hidden p-0.5">
                    <TokenSymbol className="object-contain w-5 h-5 sm:w-5 sm:h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">
                      You Pay
                    </p>
                    <p className="font-medium text-white text-base truncate">{tokenLabel}</p>
                  </div>
                </div>
                <Listbox value={inputToken} onChange={setInputToken}>
                  <div className="relative flex-shrink-0">
                    <ListboxButton
                      data-testid="bridge-token-select"
                      className="flex items-center gap-2 bg-black/50 hover:bg-black/70 transition-colors px-3 py-2 rounded-lg sm:rounded-xl border border-white/10"
                    >
                      <TokenSymbol className="object-contain w-4 h-4" />
                      <span className="text-white font-medium text-sm">{tokenLabel}</span>
                      <ChevronUpDownIcon width={14} height={14} className="text-gray-400" />
                    </ListboxButton>
                    <ListboxOptions className="absolute right-0 z-30 mt-1 w-36 overflow-auto rounded-xl bg-gray-900 border border-white/10 py-1 shadow-xl focus:outline-none">
                      {BRIDGE_TOKENS.map((token) => (
                        <ListboxOption
                          key={token.id}
                          value={token.id}
                          data-testid={`bridge-token-option-${token.id}`}
                          className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-white data-[focus]:bg-white/10"
                        >
                          <TokenSymbol token={token.id} className="object-contain w-4 h-4" />
                          <span>{token.label}</span>
                        </ListboxOption>
                      ))}
                    </ListboxOptions>
                  </div>
                </Listbox>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 sm:gap-x-4 mt-2 sm:mt-3 min-h-[32px]">
                <div className="min-w-0 flex items-center overflow-hidden">
                  <Input
                    type="text"
                    placeholder="0.0"
                    className="text-white bg-transparent text-xl sm:text-2xl font-RobotoMono placeholder-gray-500 focus:outline-none w-full min-w-0 border-0 !p-0 min-h-[28px] tabular-nums"
                    bare
                    value={amount}
                    onChange={(e) => {
                      let value = e.target.value
                      value = value.replace(/[^0-9.]/g, '')
                      const parts = value.split('.')
                      if (parts.length > 2) {
                        value = parts[0] + '.' + parts.slice(1).join('')
                      }
                      if (inputToken === 'usdc' && value.includes('.')) {
                        const [whole, frac = ''] = value.split('.')
                        value = `${whole}.${frac.slice(0, 6)}`
                      }
                      if (parseFloat(value) < 0) value = '0'
                      if (value.startsWith('0') && value.length > 1 && value[1] !== '.') {
                        value = value.substring(1)
                      }
                      setAmount(value)
                    }}
                    formatNumbers={true}
                    maxWidth="max-w-none"
                  />
                </div>
                <div className="flex items-center gap-2 sm:gap-3 justify-end shrink-0 w-[160px] sm:w-[200px]">
                  {address && (
                    <>
                      <p className="text-gray-400 text-xs whitespace-nowrap">
                        Balance: {Number(balance).toFixed(inputToken === 'usdc' ? 6 : 5)}
                      </p>
                      <button
                        className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors px-3 py-1.5 bg-blue-400/10 hover:bg-blue-400/20 rounded-lg border border-blue-400/20 flex-shrink-0"
                        onClick={() => {
                          if (inputToken === 'eth') {
                            const maxEth = Math.max(0, Number(balance) - gasReserveEth)
                            setAmount(maxEth > 0 ? String(parseFloat(maxEth.toFixed(7))) : '0')
                          } else {
                            setAmount(balance)
                          }
                        }}
                      >
                        MAX
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* You Receive */}
            <div className="bg-black/20 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-white/5 hover:bg-black/30 hover:border-white/10 transition-all duration-200 min-h-[88px] sm:min-h-[96px] flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 sm:gap-3">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0 overflow-hidden p-0.5">
                    <Image
                      src="/icons/networks/arbitrum.svg"
                      width={20}
                      height={20}
                      alt="Arbitrum"
                      className="object-contain w-5 h-5 sm:w-5 sm:h-5"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">
                      You Receive
                    </p>
                    <p className="font-medium text-white text-base truncate">
                      {tokenLabel} on Arbitrum
                    </p>
                  </div>
                </div>
                <div className="flex-shrink-0 min-w-[80px] sm:min-w-[140px]" aria-hidden="true" />
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 sm:gap-x-4 mt-2 sm:mt-3 min-h-[32px]">
                <div className="min-w-0 flex items-center">
                  <p
                    className="text-white text-xl sm:text-2xl font-RobotoMono tabular-nums"
                    data-testid="bridge-receive-amount"
                  >
                    {receiveText}
                  </p>
                </div>
                <div className="w-[160px] sm:w-[200px] shrink-0" aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-lg sm:rounded-xl p-2.5 sm:p-3 border border-amber-400/20 mb-3 sm:mb-4">
          <p className="text-amber-200 text-xs">
            Bridging can take up to 15 minutes after the transaction has been confirmed.
          </p>
          {inputToken === 'usdc' && (
            <p className="text-amber-200/80 text-xs mt-1" data-testid="bridge-usdc-fee-note">
              {usdcQuote
                ? `Up to ${formatUsdcUnits(
                    usdcQuote.maxFee
                  )} USDC covers the Circle fee. You receive native USDC on Arbitrum, which marketplace listings use.`
                : 'USDC bridges to native USDC on Arbitrum, the token marketplace listings use. A small Circle fee is deducted from the amount.'}
            </p>
          )}
        </div>

        {/* Action Button */}
        <div className="w-full">
          {!address || isEOA ? (
            <PrivyWeb3Button
              v5
              signInLabel="Sign In to Bridge to Arbitrum"
              skipNetworkCheck={skipNetworkCheck}
              requiredChain={ethereum}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white py-3 sm:py-4 px-4 rounded-xl text-base sm:text-lg font-semibold transition-all duration-200 transform hover:scale-[1.02] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:from-gray-500 disabled:to-gray-600"
              label={bridgeLabel}
              isDisabled={!isEOA || numAmount === 0 || isOverBalance || usdcBlocked}
              action={async () => {
                try {
                  if (inputToken === 'eth') {
                    await depositEth()
                  } else if (inputToken === 'mooney') {
                    await depositMooney()
                  } else {
                    await depositUsdc()
                  }
                } catch (err: any) {
                  console.log(err.message)
                  if (
                    err.message.includes('insufficient funds') ||
                    err.message.includes('No retryable data found in error')
                  ) {
                    toast.error('Insufficient balance.')
                  } else if (inputToken === 'usdc') {
                    toast.error('Could not bridge USDC.')
                  }
                }
              }}
            />
          ) : (
            <div className="text-center w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white py-3 sm:py-4 px-4 rounded-xl text-base sm:text-lg font-semibold transition-all duration-200 shadow-lg opacity-50 cursor-not-allowed disabled:from-gray-500 disabled:to-gray-600">
              {' '}
              Multi-sig not supported{' '}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
