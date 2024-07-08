import { hatIdDecimalToHex } from '@hatsprotocol/sdk-v1-core'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { HATS_ADDRESS } from 'const/config'
import { useState } from 'react'
import toast from 'react-hot-toast'
import useSafe from '@/lib/safe/useSafe'
import Modal from '../layout/Modal'
import StandardButton from '../layout/StandardButton'
import StandardButtonRight from '../layout/StandardButtonRight'

type TeamAddManagerProps = {
  multisigAddress: string
  managerHatId: any
}

type TeamAddManagerModalProps = {
  multisigAddress: string
  managerHatId: any
  setEnabled: any
}

function TeamAddManagerModal({
  multisigAddress,
  managerHatId,
  setEnabled,
}: TeamAddManagerModalProps) {
  const [hasAddedManager, setHasAddedManager] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [wearerAddress, setWearerAddress] = useState('')

  const { safe, queueSafeTx } = useSafe(multisigAddress)

  return (
    <Modal id="team-add-manager-modal" setEnabled={setEnabled}>
      <div className="flex flex-col gap-2 items-start justify-start w-auto md:w-[500px] p-4 md:p-8 bg-darkest-cool rounded-md z-[1000]">
        <div className="w-full flex items-center justify-between">
          <h2 className="font-GoodTimes">{`Add a Manager`}</h2>
          <button
            type="button"
            className="flex h-10 w-10 border-2 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
            onClick={() => setEnabled(false)}
          >
            <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
          </button>
        </div>
        <form
          className="w-full flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault()
            if (wearerAddress.length !== 42 || !wearerAddress.startsWith('0x'))
              return toast.error('Invalid address')

            const hextManagerHatId = hatIdDecimalToHex(managerHatId)
            const formattedHatId = hextManagerHatId.split('0x')[1]
            const formattedWearer = wearerAddress.split('0x')[1]
            const txData = `0x641f776e${formattedHatId}000000000000000000000000${formattedWearer}`

            await queueSafeTx({
              to: HATS_ADDRESS,
              data: txData,
              value: '0',
            })

            setHasAddedManager(true)
          }}
        >
          <input
            className="w-full p-2 border-2 dark:border-0 dark:bg-[#0f152f] rounded-sm"
            onChange={({ target }: any) => {
              setWearerAddress(target.value)
            }}
            value={wearerAddress}
            placeholder="Enter an address"
          />
          <StandardButton
            type="submit"
            className="w-full gradient-2 rounded-[5vmax]"
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Add Manager'}
          </StandardButton>
          {hasAddedManager && (
            <p>
              {`Please sign and execute the transaction in the team's `}
              <button
                className="font-bold text-light-warm"
                onClick={() => {
                  const safeNetwork =
                    process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? 'arb1' : 'sep'
                  window.open(
                    `https://app.safe.global/home?safe=${safeNetwork}:${multisigAddress}`
                  )
                }}
              >
                Safe
              </button>
            </p>
          )}
        </form>
      </div>
    </Modal>
  )
}

export default function TeamAddManager({
  multisigAddress,
  managerHatId,
}: TeamAddManagerProps) {
  const [managerModalEnabled, setManagerModalEnabled] = useState(false)

  return (
    <div
      id="button-container"
      className="pr-5 my-2 flex flex-col md:flex-row justify-start items-center gap-2"
    >
      {managerModalEnabled && (
        <TeamAddManagerModal
          multisigAddress={multisigAddress}
          managerHatId={managerHatId}
          setEnabled={setManagerModalEnabled}
        />
      )}
      <StandardButtonRight
        className="w-full gradient-2 rounded-[5vmax]"
        onClick={() => setManagerModalEnabled(true)}
      >
        Add Manager
      </StandardButtonRight>
    </div>
  )
}
