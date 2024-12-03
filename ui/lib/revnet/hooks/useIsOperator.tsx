import { useEffect, useState } from 'react'

export default function useIsOperator(
  revnetContract: any,
  operator: string,
  revnetId: number
) {
  const [isOperator, setIsOperator] = useState<boolean>(false)
  useEffect(() => {
    async function checkIsOperator() {
      if (!revnetContract) return
      const isOperator = await revnetContract.call('isSplitOperatorOf', [
        revnetId,
        operator,
      ])
      setIsOperator(isOperator)
    }
    checkIsOperator()
  }, [revnetContract])
  return isOperator
}
