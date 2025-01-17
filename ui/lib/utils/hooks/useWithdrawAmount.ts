import { BigNumber } from 'ethers'
import { useState, useEffect } from 'react'
import { readContract } from 'thirdweb'

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
      const theWithdrawAmount: any = await readContract({
        contract: votingEscrowDepositorContract,
        method: 'availableToWithdraw' as string,
        params: [userAddress],
      })
      setWithdrawAmount(BigNumber.from(theWithdrawAmount))
    }

    fetchWithdrawAmount()
  }, [votingEscrowDepositorContract, userAddress])

  return withdrawAmount
}
