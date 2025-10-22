import {
  DateEvent,
  formatSnapshotProposalMessage,
  Proposal,
  domain,
  nanceSignatureMap,
} from '@nance/nance-sdk'
import { ConnectedWallet } from '@privy-io/react-auth'
import { ethers } from 'ethers'
import { useCallback } from 'react'
import { ethers5Adapter } from 'thirdweb/adapters/ethers5'
import { ethereum } from '@/lib/rpc/chains'
import client from '@/lib/thirdweb/client'
import { SNAPSHOT_SPACE_NAME } from './constants'

const AVERAGE_BLOCK_SECONDS = 12.08

export const useSignProposal = (wallet: ConnectedWallet) => {
  const signProposalAsync = useCallback(
    async (proposal: Proposal, preTitle: string, event: DateEvent) => {
      try {
        const provider = await wallet.getEthersProvider()
        const signer = provider?.getSigner()
        const address = await signer.getAddress()
        const message = formatSnapshotProposalMessage(
          address,
          proposal,
          SNAPSHOT_SPACE_NAME,
          new Date(event.start),
          new Date(event.end)
        )
        // estimate snapshot (blocknumber) here
        const mainnet = ethers5Adapter.provider.toEthers({
          client,
          chain: ethereum,
        })
        const currentBlock = await mainnet.getBlockNumber()
        const snapshot =
          currentBlock +
          Math.floor(
            (new Date(event.start).getTime() - Date.now()) /
              1000 /
              AVERAGE_BLOCK_SECONDS
          )
        message.snapshot = snapshot
        message.title = preTitle + proposal.title
        const { types } = nanceSignatureMap['SnapshotSubmitProposal']
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

  return { signProposalAsync }
}
