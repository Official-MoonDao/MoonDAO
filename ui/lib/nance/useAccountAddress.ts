import { useWallets } from '@privy-io/react-auth'
import { useContext } from 'react'
import PrivyWalletContext from '../privy/privy-wallet-context'

export default function useAccount() {
  const { wallets, ready } = useWallets()
  const { selectedWallet } = useContext(PrivyWalletContext)
  return {
    isConnected: ready,
    isLinked: wallets[selectedWallet]?.linked,
    address: wallets[selectedWallet]?.address,
    wallet: wallets[selectedWallet],
  }
}
