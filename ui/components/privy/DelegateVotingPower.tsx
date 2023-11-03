import { useContract } from '@thirdweb-dev/react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useHandleWrite } from '../../lib/thirdweb/hooks'
import { PrivyWeb3Button } from './PrivyWeb3Button'

const SNAPSHOT_DELEGATION_ADDRESS = '0x469788fE6E9E9681C6ebF3bF78e7Fd26Fc015446'

export function DelegateVotingPower() {
  const [delegate, setDelegate] = useState<string>()

  const { contract: snapshotDelegationContract } = useContract(
    SNAPSHOT_DELEGATION_ADDRESS
  )

  const { mutateAsync: delegateVotingPower } = useHandleWrite(
    snapshotDelegationContract,
    'setDelegate',
    ['tomoondao.eth', delegate]
  )

  return (
    <div className="flex flex-col">
      <input
        placeholder="Delegate Address"
        onChange={(e: any) => setDelegate(e.target.value)}
      />
      <PrivyWeb3Button
        label="Delegate Voting Power"
        action={async () => {
          if (!delegate) return toast.error('Please enter a valid address')
          const delegateTx = await delegateVotingPower()
          if (delegateTx)
            toast.success('Voting Power has been successfully delegated!')
        }}
      />
    </div>
  )
}
