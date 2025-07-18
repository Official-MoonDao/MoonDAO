import { useWallets } from '@privy-io/react-auth'
import { useContext } from 'react'
import PrivyWalletContext from '@/lib/privy/privy-wallet-context'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import StandardButton from '../layout/StandardButton'

export default function SafeNetworkMismatch() {
  const { wallets } = useWallets()
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { selectedChain } = useContext(ChainContextV5)
  return (
    <div className="flex flex-col items-center justify-center">
      <p>{`Please switch to ${selectedChain.name} to continue.`}</p>
      <StandardButton
        className="mt-4 gradient-2 rounded-full"
        onClick={() => {
          wallets[selectedWallet].switchChain(selectedChain.id)
        }}
      >
        Switch Network
      </StandardButton>
    </div>
  )
}
