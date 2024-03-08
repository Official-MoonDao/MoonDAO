import ethers from 'ethers'
import { useState } from 'react'

export function EntitySubscriptionModal({
  setEnabled,
  nft,
  entityContract,
  validPass,
  expiresAt,
}: any) {
  const [expDate, setExpDate] = useState('')

  return (
    <div
      onMouseDown={(e: any) => {
        if (e.target.id === 'submit-tts-info-modal-backdrop') setEnabled(false)
      }}
      id="submit-tts-info-modal-backdrop"
      className="fixed top-0 left-0 w-screen h-screen bg-[#00000080] backdrop-blur-sm flex justify-center items-center z-[1000]"
    >
      <div className="flex flex-col gap-2 items-start justify-start w-auto md:w-[500px] p-4 md:p-8 bg-[#080C20] rounded-md">
        <h1 className="text-2xl font-bold">Manage Subscription</h1>
        <div className="w-full flex flex-col gap-4">
          <div className="w-full flex gap-4">
            <p>Exp Date</p>
            <input
              className="px-2 text-black"
              type="date"
              min={
                validPass
                  ? new Date(expiresAt * 1000).toISOString().split('T')[0]
                  : new Date().toISOString().split('T')[0]
              }
              value={
                validPass
                  ? new Date(expiresAt * 1000).toISOString().split('T')[0]
                  : new Date().toISOString().split('T')[0]
              }
              onChange={(e) => setExpDate(e.target.value)}
            />
          </div>
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
