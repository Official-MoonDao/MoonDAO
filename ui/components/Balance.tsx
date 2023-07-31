import React from 'react'
import { NumberType, transformNumber } from '../lib/utils/numbers'

export default function Balance({
  loading = false,
  balance,
  prefix = '',
  suffix = '',
  decimals = 2,
}: any) {
  return (
    <span className="text-base font-normal text-title-light dark:text-moon-gold tracking-wide">
      {loading ? (
        <div className="btn btn-square btn-ghost btn-disabled bg-transparent loading"></div>
      ) : balance ? (
        `${prefix}${transformNumber(
          balance,
          NumberType.string,
          decimals
        )}${suffix}`
      ) : (
        0
      )}{' '}
      <span className="font-semibold">$MOONEY</span>
    </span>
  )
}
