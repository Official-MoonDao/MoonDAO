import { useCallback, useEffect, useState } from 'react'
import { NumberType } from '../utils/numbers'

export default function useTeamSplit(
  teamContract: any,
  teamId: number | string | undefined
) {
  const [splitContractAddress, setSplitContractAddress] = useState<
    string | undefined
  >()

  async function getEntitySplitContract() {
    const split = await teamContract.call('splitContract', [teamId])
    setSplitContractAddress(split)
  }

  useEffect(() => {
    if (teamContract && teamId) getEntitySplitContract()
  }, [teamContract, teamId])

  return splitContractAddress
}
