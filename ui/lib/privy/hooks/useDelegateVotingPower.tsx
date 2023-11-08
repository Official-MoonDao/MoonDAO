import { useContract } from '@thirdweb-dev/react'
import { ethers } from 'ethers'
import { toASCII } from 'punycode'
import { useHandleWrite } from '../../thirdweb/hooks'

const SNAPSHOT_DELEGATION_ADDRESS = '0x469788fE6E9E9681C6ebF3bF78e7Fd26Fc015446'

export function useDelegateVotingPower(delegateAddress: string) {
  const { contract: snapshotDelegationContract } = useContract(
    SNAPSHOT_DELEGATION_ADDRESS
  )

  return useHandleWrite(snapshotDelegationContract, 'setDelegate', [
    ethers.utils.formatBytes32String('tomoondao.eth'),
    delegateAddress,
  ])
}
