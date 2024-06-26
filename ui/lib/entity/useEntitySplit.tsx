import { useCallback, useEffect, useState } from 'react'
import { NumberType } from '../utils/numbers'

export default function useEntitySplit(
  entityContract: any,
  entityId: number | string | undefined
) {
  const [splitContractAddress, setSplitContractAddress] = useState<
    string | undefined
  >()

  async function getEntitySplitContract() {
    const split = await entityContract.call('splitContract', [entityId])
    setSplitContractAddress(split)
  }

  useEffect(() => {
    if (entityContract && entityId) getEntitySplitContract()
  }, [entityContract, entityId])

  return splitContractAddress
}
