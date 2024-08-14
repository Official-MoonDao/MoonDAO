import { useMemo } from 'react'
import { ZERO_ADDRESS } from '../../../const/config'

//Check if closed auction has a payout
export function useClaimableAuction(
  winningBidObj: any,
  buyoutBidAmount: number,
  endTimestamp: string | number
) {
  const claimable = useMemo(() => {
    const now = Date.now() / 1000
    if (winningBidObj?.bidderAddress === ZERO_ADDRESS || !winningBidObj)
      return false
    return (
      winningBidObj.bidAmount >= +buyoutBidAmount ||
      (winningBidObj.bidAmount > 0 && +endTimestamp < now)
    )
  }, [winningBidObj, buyoutBidAmount, endTimestamp])
  return claimable
}
