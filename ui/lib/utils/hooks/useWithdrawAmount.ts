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
      // More robust checking for contract validity
      if (!votingEscrowDepositorContract || !userAddress || !votingEscrowDepositorContract.address) {
        return
      }
      
      try {
        const theWithdrawAmount: any = await readContract({
          contract: votingEscrowDepositorContract,
          method: 'availableToWithdraw' as string,
          params: [userAddress],
        })
        setWithdrawAmount(BigNumber.from(theWithdrawAmount))
      } catch (error) {
        console.error('Error fetching withdraw amount:', error)
        // Keep the current value (default 0) on error
      }
    }

    fetchWithdrawAmount()
  }, [votingEscrowDepositorContract, userAddress])

  return withdrawAmount
}
