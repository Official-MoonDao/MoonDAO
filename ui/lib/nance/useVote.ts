import { useWallets } from '@privy-io/react-auth'
import snapshot from '@snapshot-labs/snapshot.js'
import { ProposalType } from '@snapshot-labs/snapshot.js/dist/sign/types'
import { ethers, Signer, Wallet } from 'ethers'
import { useCallback, useContext } from 'react'
import PrivyWalletContext from '../privy/privy-wallet-context'
import shutterEncryptChoice from './shutter'

const hub = 'https://hub.snapshot.org' // or https://testnet.hub.snapshot.org for testnet
const client = new snapshot.Client712(hub)

export default function useVote(
  space: string,
  proposal: string,
  type: string,
  choice:
    | string
    | number
    | number[]
    | {
        [key: string]: number
      },
  reason: string = '',
  privacy: string = ''
) {
  // external state
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()

  const trigger = useCallback(async () => {
    const provider = await wallets[selectedWallet].getEthersProvider()
    const signer = provider?.getSigner()
    const address = await signer.getAddress()

    if (privacy === 'shutter') {
      const encryptedChoice = await shutterEncryptChoice(
        JSON.stringify(choice),
        proposal
      )
      return client.vote(signer as Signer as Wallet, address as any, {
        space,
        proposal,
        type: type as ProposalType,
        choice: encryptedChoice as string,
        app: 'moondao.com',
        privacy: 'shutter',
      })
    } else {
      return client.vote(signer as Signer as Wallet, address as any, {
        space,
        proposal,
        type: type as ProposalType,
        choice: choice as number | number[] | string,
        reason,
        app: 'moondao.com',
      })
    }
  }, [selectedWallet, space, proposal, type, choice, reason, privacy, wallets])

  return { trigger }
}
