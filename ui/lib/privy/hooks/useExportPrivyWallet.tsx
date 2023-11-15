import { usePrivy } from '@privy-io/react-auth'
import toast from 'react-hot-toast'
import { useDelegateVotingPower } from './useDelegateVotingPower'

export function useExportPrivyWallet(delegateAddress: string) {
  const { exportWallet } = usePrivy()
  const { mutateAsync: delegateVotingPower } =
    useDelegateVotingPower(delegateAddress)

  async function exportPrivyWallet() {
    try {
      await delegateVotingPower()
      await exportWallet()
    } catch (err) {
      console.log(err)
    }
  }

  return exportPrivyWallet
}
