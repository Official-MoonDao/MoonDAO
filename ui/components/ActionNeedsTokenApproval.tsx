import { InformationCircleIcon } from '@heroicons/react/outline'
import { BigNumber } from 'ethers'
import React, { useEffect, useState } from 'react'
import { useTokenAllowance, useTokenApproval } from '../lib/approve'
import { NumberType, transformNumber } from '../lib/numbers'
import { useAccount } from '../lib/use-wagmi'
import ActionButton from './ActionButton'

export default function ActionNeedsTokenApproval({
  className,
  children,
  amountNeeded,
  token,
  spender,
  approveText,
  action,
  preAction,
}: any) {
  const { data: account } = useAccount()
  const { data: tokenAllowance, isLoading: tokenAllowanceLoading } =
    useTokenAllowance({ token, address: account?.address, spender })
  const [approveUnlimited, setApproveUnlimited] = useState(false)
  const [weiAmountNeeded, setWeiAmountNeeded] = useState<BigNumber>(
    BigNumber.from(0)
  )

  useEffect(() => {
    if (approveUnlimited && amountNeeded > 0) {
      setWeiAmountNeeded(BigNumber.from('1000000000000000000000000000'))
    } else {
      setWeiAmountNeeded(
        transformNumber(
          amountNeeded?.formatted || amountNeeded,
          NumberType.bignumber
        ) as BigNumber
      )
    }
  }, [amountNeeded, approveUnlimited])

  const approve = useTokenApproval({
    amountNeeded: weiAmountNeeded,
    token,
    spender,
  })

  return (
    <>
      {!tokenAllowanceLoading && !approve?.isLoading ? (
        tokenAllowance?.gte(weiAmountNeeded) ? (
          <ActionButton
            className={className}
            action={action}
            preAction={preAction}
          >
            {children}
          </ActionButton>
        ) : (
          <div className="flex flex-col w-full">
            <ActionButton className={className} action={approve}>
              {approveText}
            </ActionButton>
          </div>
        )
      ) : (
        <div className={className}>
          <button className="btn btn-square btn-link btn-disabled bg-transparent loading"></button>
        </div>
      )}
    </>
  )
}
