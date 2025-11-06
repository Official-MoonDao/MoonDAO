import { getL2Network, EthBridger, Erc20Bridger } from '@arbitrum/sdk'
import { ArrowDownIcon, ChevronUpDownIcon } from '@heroicons/react/24/outline'
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
import Frame from '../layout/Frame'
import Tab from '../layout/Tab'
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
  const [inputToken, setInputToken] = useState('eth')
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
      params: [
        wallets[selectedWallet]?.address,
        '0xa3A7B6F88361F48403514059F1F16C8E78d60EeC',
      ],
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
    toast.success(
      'Your ETH has been bridged to Arbitrum. Please wait up to 15 minutes.',
      { duration: 10000 }
    )
    return depositReceipt
  }

  useEffect(() => {
    async function checkIsEOA() {
      const provider = await wallets[selectedWallet]?.getEthersProvider()
      // Get the code at the given address
      if (provider) {
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
    toast.success(
      'Your ETH has been withdrawn from Arbitrum. Please wait up to 7 days.',
      { duration: 10000 }
    )
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
    toast.success(
      'Your MOONEY has been bridged to Arbitrum. Please wait up to 15 minutes.',
      { duration: 10000 }
    )
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
    toast.success(
      'Your MOONEY has been withdrawn from Arbitrum. Please wait up to 7 days.',
      { duration: 10000 }
    )
    return withdrawReceipt
  }

  async function temporarilySkipNetworkCheck() {
    setSkipNetworkCheck(true)
    setTimeout(() => {
      setSkipNetworkCheck(false)
    }, 100)
  }

  function TokenSymbol() {
    return (
      <>
        {inputToken === 'eth' ? (
          <Image
            src={`/icons/networks/ethereum.svg`}
            width={15}
            height={15}
            alt=""
          />
        ) : (
          <Image src={`/Original.png`} width={20} height={20} alt="" />
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
    <div className="w-full max-w-2xl">
      <div className="mb-4">
        <p className="text-gray-400 text-sm">
          This bridge transfers your ETH and MOONEY tokens from Ethereum mainnet
          to Arbitrum. Arbitrum offers faster transactions and lower fees while
          maintaining full security.
        </p>
      </div>

      <div className="bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-white/10 bg-black/20">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Bridge Assets</h2>
              <p className="text-gray-400 text-xs mt-0.5">
                Transfer from Ethereum to Arbitrum
              </p>
            </div>
          </div>
        </div>

        {/* Bridge Interface */}
        <div className="p-5 space-y-5">
          {/* You Pay Section */}
          <div className="space-y-3">
            <label className="text-gray-300 text-sm font-medium">You Pay</label>
            <div className="bg-black/30 rounded-xl p-4 border border-white/10 focus-within:border-blue-400/50 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <input
                  type="number"
                  step="any"
                  placeholder="0.0"
                  className="text-white bg-transparent text-2xl font-RobotoMono placeholder-gray-500 focus:outline-none flex-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  onChange={({ target }) => {
                    let value = target.value
                    // Prevent negative values
                    if (parseFloat(value) < 0) {
                      value = '0'
                    }
                    // Remove leading zero if user types a number after it
                    if (
                      value.startsWith('0') &&
                      value.length > 1 &&
                      value[1] !== '.'
                    ) {
                      value = value.substring(1)
                    }
                    setAmount(value)
                  }}
                />

                {/* Token Selector */}
                <button
                  className="flex items-center gap-2 bg-black/50 hover:bg-black/70 transition-colors px-3 py-2 rounded-xl border border-white/10"
                  onClick={() => {
                    setInputToken(inputToken === 'eth' ? 'mooney' : 'eth')
                  }}
                >
                  <TokenSymbol />
                  <span className="text-white font-medium">
                    {inputToken.toUpperCase()}
                  </span>
                  <ChevronUpDownIcon
                    width={16}
                    height={16}
                    className="text-gray-400"
                  />
                </button>
              </div>

              {address && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">
                    Balance: {Number(balance).toFixed(5)}
                  </span>
                  <button
                    className="text-blue-400 hover:text-blue-300 font-medium transition-colors px-2 py-1 bg-blue-400/10 hover:bg-blue-400/20 rounded text-xs"
                    onClick={() => setAmount(balance)}
                  >
                    MAX
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Arrow Divider */}
          <div className="flex justify-center">
            <div className="p-3 bg-black/50 rounded-full border border-white/10">
              <ArrowDownIcon width={20} height={20} className="text-gray-400" />
            </div>
          </div>

          {/* You Receive Section */}
          <div className="space-y-3">
            <label className="text-gray-300 text-sm font-medium">
              You Receive
            </label>
            <div className="bg-black/30 rounded-xl p-4 border border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-white text-2xl font-RobotoMono">
                  {amount || '0.0'}
                </span>

                <div className="flex items-center gap-2 bg-black/50 px-3 py-2 rounded-xl border border-white/10">
                  <Image
                    src="/icons/networks/arbitrum.svg"
                    width={20}
                    height={20}
                    alt="Arbitrum"
                  />
                  <TokenSymbol />
                  <span className="text-white font-medium">
                    {inputToken.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-xl p-3 border border-amber-400/20">
            <p className="text-amber-200 text-xs">
              Bridging can take up to 15 minutes after the transaction has been
              confirmed.
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="p-5 border-t border-white/10 bg-black/10">
          {isEOA ? (
            <PrivyWeb3Button
              v5
              skipNetworkCheck={skipNetworkCheck}
              requiredChain={ethereum}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white py-3 px-6 rounded-xl text-base font-semibold transition-all duration-200 transform hover:scale-[1.01] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:from-gray-500 disabled:to-gray-600"
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
            <div className="text-center w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white py-3 px-6 rounded-xl text-base font-semibold transition-all duration-200 transform hover:scale-[1.01] shadow-lg opacity-50 cursor-not-allowed hover:scale-100 isabled:from-gray-500 to-gray-600">
              {' '}
              Multi-sig not supported{' '}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
