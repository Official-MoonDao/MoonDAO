import { XMarkIcon } from '@heroicons/react/20/solid'
import { DEFAULT_CHAIN_V5 } from 'const/config'
import toast from 'react-hot-toast'
import Modal from '../layout/Modal'

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
      <div className="w-screen md:w-[550px] mx-auto bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl text-white">
        {/* Header */}
        <div
          data-testid="safe-modal-header"
          className="flex items-center justify-between p-6 border-b border-white/10"
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
            </div>
            <div>
              <h2
                data-testid="safe-modal-title"
                className="text-xl font-semibold text-white"
              >
                Receive Funds
              </h2>
              <p className="text-gray-300 text-sm">Safe Wallet</p>
            </div>
          </div>
          <button
            data-testid="safe-modal-close"
            id="close-modal"
            type="button"
            className="p-2 hover:bg-white/10 rounded-full transition-colors duration-200"
            onClick={() => setEnabled(false)}
          >
            <XMarkIcon className="h-5 w-5 text-gray-300 hover:text-white" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-blue-400 text-sm">ℹ️</span>
              </div>
              <p className="text-blue-300 text-sm">
                {`This Safe can only receive funds on ${DEFAULT_CHAIN_V5.name}.`}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-gray-300 font-medium text-sm uppercase tracking-wide">
              Safe Address
            </label>
            <div className="bg-black/20 border border-white/10 rounded-lg p-4">
              <p className="text-white font-mono text-sm break-all">
                {safeAddress}
              </p>
            </div>
          </div>

          <button
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white py-4 px-6 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg"
            onClick={() => {
              navigator.clipboard.writeText(safeAddress)
              toast.success('Address copied to clipboard.')
            }}
          >
            Copy Address
          </button>
        </div>
      </div>
    </Modal>
  )
}
