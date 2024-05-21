import { useWallets } from '@privy-io/react-auth'
import snapshot from '@snapshot-labs/snapshot.js'
import { ProposalType } from '@snapshot-labs/snapshot.js/dist/sign/types'
import { Signer, Wallet } from 'ethers'
import { useCallback, useContext, useState } from 'react'
import PrivyWalletContext from '../privy/privy-wallet-context'

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
  reason: string = ''
) {
  // state
  const [value, setValue] = useState<unknown>()
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<any>(undefined)
  // external state
  const { selectedWallet } = useContext(PrivyWalletContext)
  const { wallets } = useWallets()

  const trigger = useCallback(async () => {
    try {
      const provider = await wallets[selectedWallet].getEthersProvider()
      const signer = provider?.getSigner()
      const address = await signer.getAddress()
      setError(undefined)
      setLoading(true)
      const receipt = await client.vote(
        signer as Signer as Wallet,
        address as any,
        {
          space,
          proposal,
          type: type as ProposalType,
          choice: choice as number | number[] | string,
          reason,
          app: 'app.moondao.com',
        }
      )
      setValue(receipt)
    } catch (err: any) {
      console.warn('🚨 useVote.trigger.error ->', err)
      setError(err)
      setValue(undefined)
    } finally {
      setLoading(false)
    }
  }, [selectedWallet, space, proposal, type, choice, reason, wallets])

  const reset = () => {
    setValue(undefined)
    setError(undefined)
    setLoading(false)
  }

  return { trigger, value, loading, error, reset }
}
