//Watch a token balance of the selected wallet
import { useWallets } from '@privy-io/react-auth'
import { useContext, useEffect, useState } from 'react'
import { readContract } from 'thirdweb'
import PrivyWalletContext from '@/lib/privy/privy-wallet-context'

export default function useWatchTokenBalance(
  tokenContract: any,
  decimals: number
) {
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()
  const [tokenBalance, setTokenBalance] = useState<any>()

  useEffect(() => {
    let provider: any
    let isMounted = true

    const wallet = wallets[selectedWallet]

    async function handleBalanceChange() {
      if (!isMounted || !tokenContract || !wallet?.address) return
      const balance: any = await readContract({
        contract: tokenContract,
        method: 'balanceOf' as string,
        params: [wallet.address],
      })
      setTokenBalance(+balance.toString() / 10 ** decimals)
    }

    async function getBalanceAndListen() {
      if (tokenContract && wallet) {
        provider = await wallet.getEthersProvider()
        await handleBalanceChange()

        provider.on('block', handleBalanceChange)
      }
    }

    getBalanceAndListen()

    return () => {
      isMounted = false
      if (provider) provider.off('block', handleBalanceChange)
    }
  }, [tokenContract, decimals, wallets, selectedWallet])

  return tokenBalance
}
