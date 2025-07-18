//Check to see if the connected wallet is on the same network as the app
import { useWallets } from '@privy-io/react-auth'
import { useContext } from 'react'
import PrivyWalletContext from '@/lib/privy/privy-wallet-context'
import ChainContextV5 from '../chain-context-v5'

export default function useNetworkMismatch() {
  const { selectedChain } = useContext(ChainContextV5)
  const { wallets } = useWallets()
  const { selectedWallet } = useContext(PrivyWalletContext)

  if (process.env.NEXT_PUBLIC_TEST_ENV === 'true') {
    return false
  }

  return selectedChain.id !== +wallets?.[selectedWallet]?.chainId?.split(':')[1]
}
