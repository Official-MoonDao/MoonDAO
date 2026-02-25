import { getL2Network, EthBridger, Erc20Bridger } from '@arbitrum/sdk'
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
import PrivyWalletContext from '../../lib/privy/privy-wallet-context'
import { arbitrum, ethereum } from '@/lib/rpc/chains'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import client from '@/lib/thirdweb/client'
import { MOONEY_ADDRESSES } from '../../const/config'
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
  const [inputToken, setInputToken] = useState('mooney')
  const bridgeType = 'deposit'
  const [nativeBalance, setNativeBalance] = useState<any>(0)
  const [ethMooneyBalance, setEthMooneyBalance] = useState<any>()
  const [isEOA, setIsEOA] = useState(false)
  const [arbMooneyBalance, setArbMooneyBalance] = useState<any>()
  const [balance, setBalance] = useState(0)
  const [skipNetworkCheck, setSkipNetworkCheck] = useState(false)

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
    const provider = await wallets[selectedWallet]?.getEthersProvider()
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
      const provider = await wallets[selectedWallet]?.getEthersProvider()
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
    const provider = await wallets[selectedWallet]?.getEthersProvider()
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
    const provider = await wallets[selectedWallet]?.getEthersProvider()
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
    const provider = await wallets[selectedWallet]?.getEthersProvider()
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

  async function temporarilySkipNetworkCheck() {
    setSkipNetworkCheck(true)
    setTimeout(() => {
      setSkipNetworkCheck(false)
    }, 100)
  }

  function TokenSymbol({ className }: { className?: string }) {
    return (
      <>
        {inputToken === 'eth' ? (
          <Image
            src={`/icons/networks/ethereum.svg`}
            width={20}
            height={20}
            alt=""
            className={className}
          />
        ) : (
          <Image
            src={`/Original.png`}
            width={20}
            height={20}
            alt=""
            className={className}
          />
        )}
      </>
    )
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
        setEthMooneyBalance((balance.toString() / 10 ** 18).toFixed(2))
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
        setArbMooneyBalance((balance.toString() / 10 ** 18).toFixed(2))
      } catch (err) {
        console.error(err)
      }
    }

    if (address) {
      getEthMooneyBalance()
      getArbMooneyBalance()
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
    }
  }, [ethMooneyBalance, nativeBalance, inputToken])

  useEffect(() => {
    temporarilySkipNetworkCheck()
    setSelectedChain(ethereum)
  }, [setSelectedChain])

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
                    <p className="font-medium text-white text-base truncate">
                      {inputToken === 'eth' ? 'ETH' : 'MOONEY'}
                    </p>
                  </div>
                </div>
                <button
                  className="flex items-center gap-2 bg-black/50 hover:bg-black/70 transition-colors px-3 py-2 rounded-lg sm:rounded-xl border border-white/10 flex-shrink-0"
                  onClick={() => {
                    setInputToken(inputToken === 'eth' ? 'mooney' : 'eth')
                  }}
                >
                  <TokenSymbol className="object-contain w-4 h-4" />
                  <span className="text-white font-medium text-sm">{inputToken.toUpperCase()}</span>
                  <ChevronUpDownIcon width={14} height={14} className="text-gray-400" />
                </button>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 sm:gap-x-4 mt-2 sm:mt-3 min-h-[32px]">
                <div className="min-w-0 flex items-center overflow-hidden">
                  <Input
                    type="text"
                    placeholder="0.0"
                    className="text-white bg-transparent text-xl sm:text-2xl font-RobotoMono placeholder-gray-500 focus:outline-none w-full min-w-0 border-0 !p-0 min-h-[28px] tabular-nums"
                    bare
                    value={amount}
                    max={balance ? Number(balance) : undefined}
                    onChange={(e) => {
                      let value = e.target.value
                      value = value.replace(/[^0-9.]/g, '')
                      const parts = value.split('.')
                      if (parts.length > 2) {
                        value = parts[0] + '.' + parts.slice(1).join('')
                      }
                      if (parseFloat(value) < 0) value = '0'
                      if (balance && parseFloat(value) > balance) {
                        value = String(balance)
                      }
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
                        Balance: {Number(balance).toFixed(5)}
                      </p>
                      <button
                        className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors px-3 py-1.5 bg-blue-400/10 hover:bg-blue-400/20 rounded-lg border border-blue-400/20 flex-shrink-0"
                        onClick={() => setAmount(balance)}
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
                      {inputToken === 'eth' ? 'ETH' : 'MOONEY'} on Arbitrum
                    </p>
                  </div>
                </div>
                <div className="flex-shrink-0 min-w-[80px] sm:min-w-[140px]" aria-hidden="true" />
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 sm:gap-x-4 mt-2 sm:mt-3 min-h-[32px]">
                <div className="min-w-0 flex items-center">
                  <p className="text-white text-xl sm:text-2xl font-RobotoMono tabular-nums">
                    {amount
                      ? amount.endsWith('.')
                        ? (parseFloat(amount) || 0).toLocaleString('en-US', { maximumFractionDigits: 18 }) + '.'
                        : (parseFloat(amount) || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 18 })
                      : '0.0'}
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
        </div>

        {/* Action Button */}
        <div className="w-full">
          {isEOA ? (
            <PrivyWeb3Button
              v5
              skipNetworkCheck={skipNetworkCheck}
              requiredChain={ethereum}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white py-3 sm:py-4 px-4 rounded-xl text-base sm:text-lg font-semibold transition-all duration-200 transform hover:scale-[1.02] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:from-gray-500 disabled:to-gray-600"
              label="Bridge to Arbitrum"
              isDisabled={!isEOA}
              action={async () => {
                try {
                  if (inputToken === 'eth') {
                    await depositEth()
                  } else {
                    await depositMooney()
                  }
                } catch (err: any) {
                  console.log(err.message)
                  if (
                    err.message.includes('insufficient funds') ||
                    err.message.includes('No retryable data found in error')
                  )
                    toast.error('Insufficient balance.')
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
