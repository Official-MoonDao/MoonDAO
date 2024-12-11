import { BigNumber } from 'ethers'
import { useState, useEffect } from 'react'

export default function useWithdrawAmount(
  votingEscrowDepositorContract: any,
  userAddress: string
) {
  const [withdrawAmount, setWithdrawAmount] = useState<BigNumber>(0)

  useEffect(() => {
    async function fetchWithdrawAmount() {
      if (!votingEscrowDepositorContract || !userAddress) return
      const theWithdrawAmount = await votingEscrowDepositorContract.call(
        'availableToWithdraw',
        [userAddress]
      )
      setWithdrawAmount(theWithdrawAmount)
    }

    fetchWithdrawAmount()
  }, [votingEscrowDepositorContract, userAddress])

  return withdrawAmount
}
