import {
  domain,
  formatSnapshotDeleteProposalMessage,
  nanceSignatureMap,
} from '@nance/nance-sdk'
import { ConnectedWallet } from '@privy-io/react-auth'
import { ethers } from 'ethers'
import { useCallback, useContext } from 'react'
import PrivyWalletContext from '../privy/privy-wallet-context'
import { SNAPSHOT_SPACE_NAME } from './constants'

export const useSignDeleteProposal = (wallet: ConnectedWallet) => {
  const { selectedWallet } = useContext(PrivyWalletContext)

  const signDeleteProposalAsync = useCallback(
    async (snapshotId: string) => {
      try {
        const privyProvider = await wallet.getEthereumProvider()
        const provider = new ethers.providers.Web3Provider(privyProvider)
        const signer = provider?.getSigner()
        const address = await signer.getAddress()

        const message = formatSnapshotDeleteProposalMessage(
          address,
          SNAPSHOT_SPACE_NAME,
          snapshotId
        )

        const { types } = nanceSignatureMap['SnapshotCancelProposal']
        if (signer) {
          const signature = await signer._signTypedData(domain, types, message)
          return { signature, message, address, domain, types }
        } else {
          throw new Error('Signer not available')
        }
      } catch (error) {
        throw error
      }
    },
    [wallet]
  )

  return { signDeleteProposalAsync }
}
