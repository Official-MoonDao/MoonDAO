//Get token balance of a connected wallet and listen for changes
import { useEffect, useState } from 'react'

export default function useTokenBalance(
  tokenContract: any,
  decimals: number,
  wallet: any
) {
  const [balance, setBalance] = useState<any>()

  useEffect(() => {
    const getBalanceAndListen = async () => {
      if (tokenContract && wallet) {
        const provider = await wallet.getEthersProvider()

        const getBalance = async () => {
          const balance = await tokenContract.call('balanceOf', [
            wallet.address,
          ])
          setBalance(+balance.toString() / 10 ** decimals)
        }

        await getBalance()

        const handleBalanceChange = async () => {
          await getBalance()
        }

        provider.on('block', handleBalanceChange)

        return () => {
          provider.off('block', handleBalanceChange)
        }
      }
    }
    getBalanceAndListen()
  }, [tokenContract, decimals, wallet])

  return balance
}
