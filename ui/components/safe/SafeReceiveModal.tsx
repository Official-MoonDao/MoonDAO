import { DEFAULT_CHAIN_V5 } from 'const/config'
import toast from 'react-hot-toast'
import Modal from '../layout/Modal'

type SafeReceiveModalProps = {
  safeAddress: string
  setEnabled: (enabled: boolean) => void
}

export default function SafeReceiveModal({ safeAddress, setEnabled }: SafeReceiveModalProps) {
  return (
    <Modal id="safe-modal" setEnabled={setEnabled} title="Receive Funds" size="lg">
      <div className="space-y-4">
        <p className="text-gray-300 text-sm -mt-4">Safe Wallet</p>
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
            <p className="text-white font-mono text-sm break-all">{safeAddress}</p>
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
    </Modal>
  )
}
