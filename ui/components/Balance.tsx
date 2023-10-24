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
    <div className="ml-3 gap-2 text-xs lg:text-base xl:text-xl font-normal text-moon-orange tracking-wide flex items-center">
      {loading ? (
        <p className="">
          <svg
            className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        </p>
      ) : balance ? (
        <p>
          `${prefix}${transformNumber(balance, NumberType.string, decimals)}$
          {suffix}`
        </p>
      ) : (
        0
      )}{' '}
      <p className="font-semibold text-moon-orange">$MOONEY</p>
    </div>
  )
}
