import { BigNumber } from 'ethers'
import { useState, useEffect, useCallback } from 'react'
import { readContract } from 'thirdweb'

export default function useWithdrawAmount(
  votingEscrowDepositorContract: any,
  userAddress: string | undefined
) {
  const [withdrawAmount, setWithdrawAmount] = useState<BigNumber>(
    BigNumber.from(0)
  )

  const fetchWithdrawAmount = useCallback(async () => {
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
  }, [votingEscrowDepositorContract, userAddress])

  useEffect(() => {
    fetchWithdrawAmount()
  }, [fetchWithdrawAmount])

  return { withdrawAmount, refresh: fetchWithdrawAmount }
}
