import { useWallets } from '@privy-io/react-auth'
import { useContext } from 'react'
import PrivyWalletContext from '../privy/privy-wallet-context'

export default function useAccountAddress() {
  const { wallets, ready } = useWallets()
  const { selectedWallet } = useContext(PrivyWalletContext)
  return { address: wallets[selectedWallet]?.address, isConnected: ready }
}
