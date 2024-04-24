import { getL2Network, EthBridger, Erc20Bridger } from '@arbitrum/sdk'
import { useWallets } from '@privy-io/react-auth'
import { Arbitrum, Ethereum } from '@thirdweb-dev/chains'
import { useContract } from '@thirdweb-dev/react'
import { BigNumber, ethers } from 'ethers'
import { useContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import PrivyWalletContext from '../../lib/privy/privy-wallet-context'
import { useHandleRead } from '../../lib/thirdweb/hooks'
import { initSDK } from '../../lib/thirdweb/thirdweb'
import { MOONEY_ADDRESSES } from '../../const/config'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'

export default function ArbitrumBridge({ setSelectedChain }: any) {
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()
  const [amount, setAmount] = useState<any>(0)
  const [inputToken, setInputToken] = useState('eth')
  const [withdraw, setWithdraw] = useState(false)

  const [ethMooneyBalance, setEthMooneyBalance] = useState<any>()
  const [arbMooneyBalance, setArbMooneyBalance] = useState<any>()
  const [nativeBalance, setNativeBalance] = useState<any>()

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

    const depositTx = await ethBridger.deposit({
      amount: ethers.utils.parseEther(amount),
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

    return withdrawReceipt
  }

  useEffect(() => {
    getEthMooneyBalance()
    getArbMooneyBalance()
  }, [wallets])

  useEffect(() => {
    if (withdraw) {
      setSelectedChain(Arbitrum)
    } else {
      setSelectedChain(Ethereum)
    }
  }, [withdraw])

  return (
    <div className="border-2 p-8 flex flex-col">
      <p>{`$MOONEY(ETH) : ${ethMooneyBalance || 0}`}</p>
      <p>{`$MOONEY(ARB) : ${arbMooneyBalance || 0}`}</p>
      <div className="flex gap-4" onClick={() => setWithdraw((prev) => !prev)}>
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
