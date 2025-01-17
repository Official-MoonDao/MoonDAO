import { getL2Network, EthBridger, Erc20Bridger } from '@arbitrum/sdk'
import { ArrowDownIcon, ChevronUpDownIcon } from '@heroicons/react/24/outline'
import { useWallets } from '@privy-io/react-auth'
import { Arbitrum, Ethereum } from '@thirdweb-dev/chains'
import { useAddress } from '@thirdweb-dev/react'
import { ethers } from 'ethers'
import Image from 'next/image'
import { useContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import PrivyWalletContext from '../../lib/privy/privy-wallet-context'
import { initSDK } from '../../lib/thirdweb/thirdweb'
import ChainContext from '@/lib/thirdweb/chain-context'
import { MOONEY_ADDRESSES } from '../../const/config'
import Frame from '../layout/Frame'
import Tab from '../layout/Tab'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'

export default function ArbitrumBridge() {
  const address = useAddress()
  const { selectedChain, setSelectedChain } = useContext(ChainContext)
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()
  const [amount, setAmount] = useState<any>(0)
  const [inputToken, setInputToken] = useState('eth')
  const [bridgeType, setBridgeType] = useState('deposit')
  const [nativeBalance, setNativeBalance] = useState<any>(0)
  const [ethMooneyBalance, setEthMooneyBalance] = useState<any>()
  const [arbMooneyBalance, setArbMooneyBalance] = useState<any>()
  const [balance, setBalance] = useState(0)
  const [skipNetworkCheck, setSkipNetworkCheck] = useState(false)

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
    const privyProvider = await wallets[selectedWallet]?.getEthereumProvider()
    const provider = new ethers.providers.Web3Provider(privyProvider)
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
  async function withdrawEth() {
    const l2Network = await getL2Network(Arbitrum.chainId)
    const ethBridger = new EthBridger(l2Network)
    const privyProvider = await wallets[selectedWallet]?.getEthereumProvider()
    const provider = new ethers.providers.Web3Provider(privyProvider)
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
    const l2Network = await getL2Network(Arbitrum.chainId)
    const erc20Bridger = new Erc20Bridger(l2Network)
    const privyProvider = await wallets[selectedWallet]?.getEthereumProvider()
    const provider = new ethers.providers.Web3Provider(privyProvider)
    const signer = provider.getSigner()
    const l2SDK = initSDK(Arbitrum)
    const l2Provider = l2SDK.getProvider()
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
    const l2Network = await getL2Network(Arbitrum.chainId)
    const erc20Bridger = new Erc20Bridger(l2Network)
    const privyProvider = await wallets[selectedWallet]?.getEthereumProvider()
    const provider = new ethers.providers.Web3Provider(privyProvider)
    const signer = provider.getSigner()
    const l2SDK = initSDK(Arbitrum)
    const l2Provider = l2SDK.getProvider()
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
          <Image src={`/original.png`} width={20} height={20} alt="" />
        )}
      </>
    )
  }

  useEffect(() => {
    async function getEthMooneyBalance() {
      const sdk = initSDK(Ethereum)
      const contract = await sdk.getContract(MOONEY_ADDRESSES['ethereum'])
      const balance = await contract.call('balanceOf', [
        wallets[selectedWallet]?.address,
      ])
      setEthMooneyBalance((balance.toString() / 10 ** 18).toFixed(2))
    }
    async function getArbMooneyBalance() {
      const sdk = initSDK(Arbitrum)
      const contract = await sdk.getContract(MOONEY_ADDRESSES['arbitrum'])
      const balance = await contract.call('balanceOf', [
        wallets[selectedWallet]?.address,
      ])
      setArbMooneyBalance((balance.toString() / 10 ** 18).toFixed(2))
    }

    if (address) {
      getEthMooneyBalance()
      getArbMooneyBalance()
    }
  }, [address, selectedChain])

  useEffect(() => {
    async function getEthBalance() {
      const provider = initSDK(Ethereum).getProvider()
      const balance = await provider.getBalance(wallets[selectedWallet].address)
      if (bridgeType === 'deposit') {
        setNativeBalance((+balance / 10 ** 18).toFixed(5))
      }
    }

    async function getArbBalance() {
      const provider = initSDK(Arbitrum).getProvider()
      const balance = await provider.getBalance(wallets[selectedWallet].address)
      if (bridgeType === 'withdraw') {
        setNativeBalance((+balance / 10 ** 18).toFixed(5))
      }
    }

    if (address) {
      getEthBalance()
      getArbBalance()
    }
  }, [address, wallets, bridgeType, inputToken])

  useEffect(() => {
    if (inputToken === 'eth') {
      setBalance(nativeBalance)
    } else if (inputToken === 'mooney' && bridgeType === 'deposit') {
      setBalance(ethMooneyBalance)
    } else if (inputToken === 'mooney' && bridgeType === 'withdraw') {
      setBalance(arbMooneyBalance)
    }
  }, [
    ethMooneyBalance,
    arbMooneyBalance,
    nativeBalance,
    inputToken,
    bridgeType,
  ])

  useEffect(() => {
    temporarilySkipNetworkCheck()
    if (bridgeType === 'withdraw') {
      setSelectedChain(Arbitrum)
    } else {
      setSelectedChain(Ethereum)
    }
  }, [bridgeType, setSelectedChain])

  return (
    <div className="max-w-[500px] w-full flex flex-col gap-1">
      <div className="ml-1">
        <Frame noPadding>
          <div className="flex flex-wrap text-sm bg-filter">
            <Tab
              tab="deposit"
              currentTab={bridgeType}
              setTab={setBridgeType}
              icon=""
            >
              Deposit
            </Tab>
            <Tab
              tab="withdraw"
              currentTab={bridgeType}
              setTab={setBridgeType}
              icon=""
            >
              Withdraw
            </Tab>
          </div>
        </Frame>
      </div>
      <div className="flex flex-col p-4 gap-2 bg-darkest-cool min-h-[150px] rounded-lg">
        <p className="opacity-50">You Pay</p>
        <div className="flex justify-between">
          <input
            className="text-white bg-transparent md:text-2xl"
            placeholder="Amount"
            pattern="[0-9]*[.,]?[0-9]*"
            onChange={({ target }) => {
              setAmount(target.value)
            }}
          />

          <button
            className="p-2 flex items-center gap-2 bg-black rounded-full"
            onClick={() => {
              setInputToken(inputToken === 'eth' ? 'mooney' : 'eth')
            }}
          >
            {bridgeType === 'withdraw' && (
              <Image
                src="/icons/networks/arbitrum.svg"
                width={20}
                height={20}
                alt=""
              />
            )}
            <TokenSymbol />
            <p>{inputToken.toLocaleUpperCase()}</p>
            <ChevronUpDownIcon width={20} height={20} />
          </button>
        </div>

        {address && (
          <p className="opacity-50">{`Balance: ${Number(
            balance
          ).toLocaleString()}`}</p>
        )}
      </div>
      <div className="h-0 w-full flex justify-center items-center z-[5]">
        <div className="p-4 bg-[#29253f] rounded-full">
          <ArrowDownIcon width={25} height={25} />
        </div>
      </div>

      <div className="flex flex-col p-4 gap-2 bg-darkest-cool min-h-[150px] rounded-lg">
        <p className="opacity-50">You Receive</p>
        <div className="flex justify-between items-center">
          <p className="md:text-2xl">{amount?.toLocaleString() || 0}</p>
          <div className="p-2 flex items-center gap-2 bg-black rounded-full">
            {bridgeType === 'deposit' && (
              <Image
                src="/icons/networks/arbitrum.svg"
                width={20}
                height={20}
                alt=""
              />
            )}
            <TokenSymbol />
            <p>{inputToken.toLocaleUpperCase()}</p>
          </div>
        </div>
      </div>

      <PrivyWeb3Button
        skipNetworkCheck={skipNetworkCheck}
        requiredChain={bridgeType === 'withdraw' ? Arbitrum : Ethereum}
        className="mt-2 rounded-[5vmax] rounded-tl-[20px]"
        label={bridgeType === 'deposit' ? 'Bridge' : 'Withdraw'}
        action={async () => {
          try {
            if (bridgeType === 'withdraw') {
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
          } catch (err: any) {
            console.log(err.message)
            if (
              err.message.includes('insufficient funds') ||
              err.message.includes('No retryable data found in error')
            )
              toast.error('Insufficient balance')
          }
        }}
      />
      <div className="bg-darkest-cool p-4 rounded-lg">
        <p className="opacity-[50%]">
          {`${
            bridgeType === 'deposit' ? 'Bridging' : 'Withdrawing'
          } can take up to ${
            bridgeType === 'deposit' ? '15 minutes' : '7 days'
          } after
          the transaction has been confirmed.`}
        </p>
      </div>
    </div>
  )
}
