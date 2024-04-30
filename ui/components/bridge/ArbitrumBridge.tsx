import { getL2Network, EthBridger, Erc20Bridger } from '@arbitrum/sdk'
import {
  ArrowDownIcon,
  ArrowsUpDownIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline'
import { useWallets } from '@privy-io/react-auth'
import { Arbitrum, Ethereum } from '@thirdweb-dev/chains'
import { useAddress } from '@thirdweb-dev/react'
import { ethers } from 'ethers'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import PrivyWalletContext from '../../lib/privy/privy-wallet-context'
import { initSDK } from '../../lib/thirdweb/thirdweb'
import { useNativeBalance } from '@/lib/thirdweb/hooks/useNativeBalance'
import { useShallowQueryRoute } from '@/lib/utils/hooks'
import { MOONEY_ADDRESSES } from '../../const/config'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'

export default function ArbitrumBridge({
  selectedChain,
  setSelectedChain,
}: any) {
  const router = useRouter()
  const address = useAddress()
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()
  const [amount, setAmount] = useState<any>(0)
  const [inputToken, setInputToken] = useState('eth')
  const [inputTokenDropdown, setInputTokenDropdown] = useState(false)
  const [withdraw, setWithdraw] = useState(
    router.query.type === 'withdraw' ? true : false
  )

  const [ethMooneyBalance, setEthMooneyBalance] = useState<any>()
  const [arbMooneyBalance, setArbMooneyBalance] = useState<any>()
  const nativeBalance = useNativeBalance()
  const [balance, setBalance] = useState<any>()

  const shallowQueryRoute = useShallowQueryRoute()

  async function getEthMooneyBalance() {
    const sdk = initSDK(Ethereum)
    const contract = await sdk.getContract(MOONEY_ADDRESSES['ethereum'])
    const balance = await contract.call('balanceOf', [
      wallets[selectedWallet]?.address,
    ])

    setEthMooneyBalance(balance.toString() / 10 ** 18)
  }

  async function getArbMooneyBalance() {
    const sdk = initSDK(Arbitrum)
    const contract = await sdk.getContract(MOONEY_ADDRESSES['arbitrum'])
    const balance = await contract.call('balanceOf', [
      wallets[selectedWallet]?.address,
    ])

    setArbMooneyBalance(balance.toString() / 10 ** 18)
  }

  async function approveMooney(signer: any, erc20Bridger: any) {
    const sdk = initSDK(Ethereum)
    const mooneyContract = await sdk.getContract(MOONEY_ADDRESSES['ethereum'])
    const allowance = await mooneyContract.call('allowance', [
      wallets[selectedWallet]?.address,
      '0xa3A7B6F88361F48403514059F1F16C8E78d60EeC',
    ])

    if (ethers.utils.parseEther(amount).gt(allowance)) {
      //approve mooney
      const approveTx = await erc20Bridger.approveToken({
        l1Signer: signer,
        erc20L1Address: MOONEY_ADDRESSES['ethereum'],
      })

      const approveReceipt = await approveTx.wait()

      toast.success('Approved MOONEY')

      return approveReceipt
    }
  }

  async function depositEth() {
    const l2Network = await getL2Network(Arbitrum.chainId)
    const ethBridger = new EthBridger(l2Network)
    const provider = await wallets[selectedWallet]?.getEthersProvider()
    const signer = provider.getSigner()

    const nativeAmount = ethers.utils.parseEther(amount)

    if (+nativeAmount.toString() / 10 ** 18 > nativeBalance) {
      return toast.error('Insufficient balance')
    }

    const depositTx = await ethBridger.deposit({
      amount: nativeAmount,
      l1Signer: signer,
    })

    const depositReceipt = await depositTx.wait()

    return depositReceipt
  }

  async function withdrawEth() {
    const l2Network = await getL2Network(Arbitrum.chainId)
    const ethBridger = new EthBridger(l2Network)
    const provider = await wallets[selectedWallet]?.getEthersProvider()
    const signer = provider.getSigner()

    const nativeAmount = ethers.utils.parseEther(amount)

    if (+nativeAmount.toString() / 10 ** 18 > nativeBalance) {
      return toast.error('Insufficient balance')
    }

    const withdrawTx = await ethBridger.withdraw({
      amount: ethers.utils.parseEther(amount),
      l2Signer: signer,
      destinationAddress: wallets[selectedWallet]?.address,
      from: wallets[selectedWallet]?.address,
    })

    const withdrawReceipt = await withdrawTx.wait()

    return withdrawReceipt
  }

  async function depositMooney() {
    const l2Network = await getL2Network(Arbitrum.chainId)
    const erc20Bridger = new Erc20Bridger(l2Network)
    const provider = await wallets[selectedWallet]?.getEthersProvider()
    const signer = provider.getSigner()
    const l2SDK = initSDK(Arbitrum)
    const l2Provider = l2SDK.getProvider()

    //check balance
    if (+amount > ethMooneyBalance) {
      return toast.error('Insufficient balance')
    }

    //get allowance
    approveMooney(signer, erc20Bridger)

    //deposit mooney
    const depositTx = await erc20Bridger.deposit({
      amount: ethers.utils.parseEther(amount),
      erc20L1Address: MOONEY_ADDRESSES['ethereum'],
      l1Signer: signer,
      l2Provider,
    })

    const depositReceipt = await depositTx.wait()

    return depositReceipt
  }

  async function withdrawMooney() {
    const l2Network = await getL2Network(Arbitrum.chainId)
    const erc20Bridger = new Erc20Bridger(l2Network)
    const provider = await wallets[selectedWallet]?.getEthersProvider()
    const signer = provider.getSigner()

    //check balance
    if (+amount > arbMooneyBalance) {
      return toast.error('Insufficient balance')
    }

    //withdraw mooney
    const withdrawTx = await erc20Bridger.withdraw({
      amount: ethers.utils.parseEther(amount),
      destinationAddress: wallets[selectedWallet]?.address,
      erc20l1Address: MOONEY_ADDRESSES['ethereum'],
      l2Signer: signer,
    })

    const withdrawReceipt = await withdrawTx.wait()

    return withdrawReceipt
  }

  useEffect(() => {
    getEthMooneyBalance()
    getArbMooneyBalance()
  }, [wallets])

  useEffect(() => {
    setWithdraw(router.query.type === 'withdraw' ? true : false)
  }, [router.query])

  useEffect(() => {
    if (withdraw) {
      setSelectedChain(Arbitrum)
    } else {
      setSelectedChain(Ethereum)
    }
  }, [withdraw])

  useEffect(() => {
    if (inputToken === 'eth') {
      setBalance(nativeBalance)
    } else {
      if (withdraw) {
        setBalance(arbMooneyBalance)
      } else {
        setBalance(ethMooneyBalance)
      }
    }
  }, [
    withdraw,
    selectedChain,
    nativeBalance,
    ethMooneyBalance,
    arbMooneyBalance,
    inputToken,
  ])

  return (
    <div className="max-w-[500px] w-full flex flex-col gap-1">
      <div className="flex flex-col p-4 gap-2 bg-[#120f21] min-h-[150px] rounded-lg">
        <p className="text-2xl">{`From ${
          withdraw ? 'Arbitrum' : 'Ethereum'
        }`}</p>
        <p className="opacity-50">You Pay</p>
        <div className="flex justify-between">
          <input
            className="text-white bg-transparent md:text-2xl"
            placeholder="Amount"
            onChange={({ target }: any) => setAmount(target.value)}
          />
          <div className="min-w-[125px] p-2 bg-black rounded-full">
            <div
              className="flex items-center justify-between gap-2"
              onClick={() => setInputTokenDropdown((prev) => !prev)}
            >
              {inputToken === 'eth' ? (
                <span className="flex items-center gap-2">
                  <Image
                    src="/icons/networks/ethereum.svg"
                    width={15}
                    height={15}
                    alt=""
                  />
                  {'ETH'}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Image src="/original.png" width={20} height={20} alt="" />
                  {'MOONEY'}
                </span>
              )}
              <ChevronDownIcon width={15} height={15} />
            </div>
            {inputTokenDropdown && (
              <div className="absolute bg-black mt-2 rounded-lg">
                <button
                  className="p-2 w-full text-left"
                  onClick={() => {
                    setInputToken('eth')
                    setInputTokenDropdown(false)
                  }}
                >
                  ETH
                </button>
                <button
                  className="p-2 w-full text-left"
                  onClick={() => {
                    setInputToken('mooney')
                    setInputTokenDropdown(false)
                  }}
                >
                  MOONEY
                </button>
              </div>
            )}
          </div>
        </div>
        {address && <p className="opacity-50 w-1/2">{`Balance: ${balance}`}</p>}
      </div>

      <div className="h-0 w-full flex justify-center items-center z-10">
        <div
          className={`p-4 bg-[#29253f] rounded-full hover:scale-105 duration-300 ${
            withdraw && 'rotate-180'
          }`}
          onClick={() => {
            setWithdraw((prev) => !prev)
            shallowQueryRoute({
              type: withdraw ? 'deposit' : 'withdraw',
            })
          }}
        >
          <ArrowsUpDownIcon width={25} height={25} />
        </div>
      </div>
      <div className="flex flex-col p-4 gap-2 bg-[#120f21] min-h-[150px] rounded-lg">
        <p className="text-2xl">{`To ${withdraw ? 'Ethereum' : 'Arbitrum'}`}</p>
        <p className="opacity-50">You Receive</p>
        <div className="flex justify-between items-center">
          <p className="md:text-2xl">{amount}</p>
          <div className="p-2 flex items-center gap-2 bg-black rounded-full">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 bg-black rounded-full">
                {inputToken === 'mooney' ? (
                  <>
                    <Image
                      src={`/original.png`}
                      width={20}
                      height={20}
                      alt=""
                    />
                    <p>MOONEY</p>
                  </>
                ) : (
                  <>
                    <Image
                      src={`/icons/networks/ethereum.svg`}
                      width={15}
                      height={15}
                      alt=""
                    />
                    <p>ETH</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <PrivyWeb3Button
        className="mt-4 w-full bg-moon-orange"
        label="Bridge"
        action={async () => {
          if (withdraw) {
            if (inputToken === 'eth') {
              await withdrawEth()
            } else {
              await withdrawMooney()
            }
          } else {
            if (inputToken === 'eth') {
              await depositEth()
            } else {
              await depositMooney()
            }
          }
        }}
      />
      {withdraw && (
        <p className="opacity-50">{`*withdrawls can take up to 7 days.*`}</p>
      )}
    </div>
  )

  return (
    <div className="page-border-and-color p-8 flex flex-col">
      <p>{`$MOONEY(ETH) : ${ethMooneyBalance || 0}`}</p>
      <p>{`$MOONEY(ARB) : ${arbMooneyBalance || 0}`}</p>
      <div
        className="flex gap-4"
        onClick={() => {
          setWithdraw((prev) => !prev)
          shallowQueryRoute({
            type: withdraw ? 'deposit' : 'withdraw',
          })
        }}
      >
        <button className={`px-2 py-2 ${!withdraw && 'border-2'}`}>
          Deposit
        </button>
        <button className={`px-2 py-2 ${withdraw && 'border-2'}`}>
          Withdraw
        </button>
      </div>
      <div className="flex">
        <select
          className="text-black"
          onChange={({ target }) => setInputToken(target.value)}
        >
          <option value={'eth'}>ETH</option>
          <option value={'mooney'}>MOONEY</option>
        </select>
        <input
          className="px-2 text-black"
          placeholder="Amount"
          onChange={({ target }: any) => setAmount(target.value)}
        />
      </div>
      <PrivyWeb3Button
        className="mt-4 bg-white max-w-[300px]"
        label="Bridge"
        action={async () => {
          if (withdraw) {
            if (inputToken === 'eth') {
              await withdrawEth()
            } else {
              await withdrawMooney()
            }
          } else {
            if (inputToken === 'eth') {
              await depositEth()
            } else {
              await depositMooney()
            }
          }
        }}
      />
    </div>
  )
}
