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
        
        if (!signer) {
          throw new Error('Signer not available')
        }

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

        let signature: string

        try {
          // Try the standard EIP-712 signTypedData method first
          // This works with most wallets including Coinbase Smart Wallets
          if (typeof (signer as any).signTypedData === 'function') {
            console.log('Using public signTypedData method')
            signature = await (signer as any).signTypedData(domain, types, message)
          } else if (typeof (signer as any)._signTypedData === 'function') {
            // Fallback to internal method for older wallets
            console.log('Using internal _signTypedData method')
            signature = await (signer as any)._signTypedData(domain, types, message)
          } else {
            throw new Error('Wallet does not support EIP-712 typed data signing')
          }
        } catch (signingError: any) {
          console.error('EIP-712 signing failed:', signingError)
          
          // Enhanced error messages for better debugging
          if (signingError.code === 4001 || signingError.message?.includes('User rejected')) {
            throw new Error('Signature request was rejected. Please try again.')
          } else if (signingError.message?.includes('not support')) {
            throw new Error('Your wallet does not support the required signing method. Please try a different wallet.')
          } else if (signingError.name === 'TimeoutError') {
            throw signingError
          } else {
            throw new Error(`Failed to sign proposal: ${signingError.message || 'Unknown error'}`)
          }
        }

        return { signature, message, address, domain, types }
      } catch (error) {
        throw error
      }
    },
    [wallet]
  )

  return { signProposalAsync }
}
