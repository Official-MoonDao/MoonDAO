import { ethers } from 'ethers'
import { useState } from 'react'

export function EntitySubscriptionModal({
  setEnabled,
  nft,
  entityContract,
  validPass,
  expiresAt,
}: any) {
  const [expDate, setExpDate] = useState<Date>()

  function getFutureDateByYear(years: number): Date {
    const currentDate: Date = new Date()
    const futureDate: Date = new Date(
      currentDate.getFullYear() + years,
      currentDate.getMonth(),
      currentDate.getDate()
    )
    return futureDate
  }

  return (
    <div
      onMouseDown={(e: any) => {
        if (e.target.id === 'entity-subscription-modal-backdrop')
          setEnabled(false)
      }}
      id="entity-subscription-modal-backdrop"
      className="fixed top-0 left-0 w-screen h-screen bg-[#00000080] backdrop-blur-sm flex justify-center items-center z-[1000]"
    >
      <div className="flex flex-col gap-2 items-start justify-start w-auto md:w-[500px] p-4 md:p-8 bg-[#080C20] rounded-md">
        <h1 className="text-2xl font-bold">Manage Subscription</h1>
        <div className="w-full flex flex-col gap-4">
          <div className="w-full flex gap-4">
            <p>
              {`Expiration Date: `}
              <span
                className={validPass ? 'text-moon-green' : 'text-moon-orange'}
              >
                {validPass
                  ? new Date(expiresAt?.toString() * 1000).toLocaleString()
                  : 'Expired'}
              </span>
            </p>
          </div>
          <p>
            Select the number of years you would like to extend your
            subscription for from now.
          </p>
          <input
            className="px-2 text-black w-[75px]"
            type="number"
            min={0}
            onChange={(e) => {
              const futureDate = getFutureDateByYear(parseInt(e.target.value))
              setExpDate(futureDate)
            }}
          />
          <button
            className="border-2 px-4 py-2"
            onClick={async () => {
              const subscriptionCost = ethers.utils.parseEther('0.01')
              const timestamp = new Date(expDate).getTime() / 1000

              await entityContract.call(
                'renewSubscription',
                nft.metadata.id,
                timestamp,
                {
                  value: subscriptionCost,
                }
              )
            }}
          >
            Renew Subscription
          </button>
        </div>
      </div>
    </div>
  )
}
