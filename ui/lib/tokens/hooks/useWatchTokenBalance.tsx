//Watch a token balance of the selected wallet
import { useWallets } from '@privy-io/react-auth'
import { useAddress, useContractRead, useSDK } from '@thirdweb-dev/react'
import { useContext, useEffect, useState } from 'react'
import PrivyWalletContext from '@/lib/privy/privy-wallet-context'

export default function useWatchTokenBalance(
  tokenContract: any,
  decimals: number
) {
  const address = useAddress()
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()
  const [tokenBalance, setTokenBalance] = useState<any>()

  useEffect(() => {
    let provider: any

    const wallet = wallets[selectedWallet]

    async function handleBalanceChange() {
      if (address === wallet.address) {
        const balance = await tokenContract.call('balanceOf', [wallet.address])
        setTokenBalance(+balance.toString() / 10 ** decimals)
      }
    }

    async function getBalanceAndListen() {
      if (tokenContract && wallet) {
        provider = await wallet.getEthersProvider()
        await handleBalanceChange()

        provider.on('block', handleBalanceChange)
      }
    }

    setTokenBalance(undefined)

    getBalanceAndListen()

    return () => {
      if (provider) provider.off('block', handleBalanceChange)
    }
  }, [tokenContract, decimals, wallets, selectedWallet])

  return tokenBalance
}
