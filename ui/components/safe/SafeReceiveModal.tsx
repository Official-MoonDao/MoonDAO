import { XMarkIcon } from '@heroicons/react/20/solid'
import { DEFAULT_CHAIN_V5 } from 'const/config'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { SafeData } from '@/lib/safe/useSafe'
import Modal from '../layout/Modal'
import StandardButton from '../layout/StandardButton'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'

type SafeReceiveModalProps = {
  safeAddress: string
  setEnabled: (enabled: boolean) => void
}

export default function SafeReceiveModal({
  safeAddress,
  setEnabled,
}: SafeReceiveModalProps) {
  return (
    <Modal id="safe-modal" setEnabled={setEnabled}>
      <div
        data-testid="safe-modal-content"
        className="bg-dark-cool rounded-[2vmax] p-8 max-w-2xl min-w-[350px] w-full relative md:min-w-[600px]"
      >
        <div
          data-testid="safe-modal-header"
          className="w-full flex items-center justify-between"
        >
          <h1
            data-testid="safe-modal-title"
            className="text-2xl font-GoodTimes "
          >
            Receive Funds
          </h1>
          <button
            data-testid="safe-modal-close"
            id="close-modal"
            type="button"
            className="flex h-10 w-10 border-2 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
            onClick={() => setEnabled(false)}
          >
            <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-2 flex flex-col gap-4">
          <p className="text-lg">
            {`This Safe can only receive funds on ${DEFAULT_CHAIN_V5.name}.`}
          </p>
          <p className="">{safeAddress}</p>
          <StandardButton
            className="gradient-2 rounded-full"
            onClick={() => {
              navigator.clipboard.writeText(safeAddress)
              toast.success('Address copied to clipboard.')
            }}
            hoverEffect={false}
          >
            Copy Address
          </StandardButton>
        </div>
      </div>
    </Modal>
  )
}
