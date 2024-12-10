import { useState, useEffect } from 'react'

export default function useWithdrawAmount(
  votingEscrowDepositorContract: any,
  userAddress: string
) {
  const [withdrawAmount, setWithdrawAmount] = useState<number>(0)

  useEffect(() => {
    async function fetchWithdrawAmount() {
      if (!votingEscrowDepositorContract || !userAddress) return
      const theWithdrawAmount = await votingEscrowDepositorContract.call(
        'availableToWithdraw',
        [userAddress]
      )
      setWithdrawAmount(Number(theWithdrawAmount))
    }

    fetchWithdrawAmount()
  }, [votingEscrowDepositorContract, userAddress])

  return withdrawAmount
}
