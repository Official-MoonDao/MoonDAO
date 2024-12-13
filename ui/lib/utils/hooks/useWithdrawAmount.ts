import { BigNumber } from 'ethers'
import { useState, useEffect } from 'react'

export default function useWithdrawAmount(
  votingEscrowDepositorContract: any,
  userAddress: string | undefined
) {
  const [withdrawAmount, setWithdrawAmount] = useState<BigNumber>(
    BigNumber.from(0)
  )

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
