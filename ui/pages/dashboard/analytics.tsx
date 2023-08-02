import { useRouter } from 'next/router'
import React, { useEffect, useState } from 'react'
import VMooneyPage from '../../components/dashboard/analytics/VMooneyPage'
import TreasuryPage from '../../components/dashboard/treasury/TreasuryPage'

export default function Analytics() {
  const [isTreasury, setIsTreasury] = useState(false)

  return (
    <div className="animate-fadeIn">
      {/* Toggle for analytics (vmooney <=> treasury) */}
      <div className="flex items-center rounded-full gap-2 bg-detail-light dark:bg-stronger-dark py-2 px-5 w-[400px]">
        <p className="font-semibold tracking-wide text-gray-50">Voting Power</p>
        <div
          id="dashboard-analytics-toggle"
          onClick={() => setIsTreasury(!isTreasury)}
          className="relative w-[100px] h-[28px] rounded-full bg-gray-300 dark:bg-slate-200"
        >
          <div
            className={`absolute -top-[3px] h-[33px] w-[33px] rounded-full bg-moon-blue dark:bg-moon-gold duration-300 ease-in-out ${
              isTreasury && 'translate-x-[70px]'
            }`}
          />
        </div>
        <p className="font-semibold tracking-wide text-gray-50">Treasury</p>
      </div>
      {isTreasury ? <TreasuryPage /> : <VMooneyPage />}
    </div>
  )
}

// add locales for Analytics title and desc
