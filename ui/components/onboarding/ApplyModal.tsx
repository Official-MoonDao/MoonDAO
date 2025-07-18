//Modal for tier application typeform
import { XMarkIcon } from '@heroicons/react/24/outline'
import { Widget } from '@typeform/embed-react'
import { useCallback } from 'react'
import toast from 'react-hot-toast'
import Modal from '../layout/Modal'

type ApplyModalProps = {
  type: string
  setEnabled: Function
}

export default function ApplyModal({ type, setEnabled }: ApplyModalProps) {
  const submitTypeform = useCallback(async () => {
    toast.success('Application submitted!')
    setEnabled(false)
  }, [setEnabled])

  return (
    <Modal id="apply-modal-backdrop" setEnabled={setEnabled}>
      <div className="w-full flex flex-col gap-6 items-start justify-start w-auto md:w-[700px] p-8 bg-gradient-to-b from-slate-800/90 to-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-[2vmax] shadow-2xl min-h-[80vh] max-h-[90vh] md:min-h-auto md:max-h-[80vh] overflow-hidden">
        <div className="w-full flex items-center justify-between flex-shrink-0">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-GoodTimes text-white">Apply to MoonDAO</h2>
            <p className="text-slate-300 text-sm">Complete the application form below to join our community</p>
          </div>
          <button
            type="button"
            className="flex h-10 w-10 border-2 border-slate-600 items-center justify-center rounded-full hover:border-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
            onClick={() => setEnabled(false)}
          >
            <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
          </button>
        </div>
        <div className="w-full bg-gradient-to-b from-slate-700/30 to-slate-800/40 rounded-2xl border border-slate-600/30 overflow-hidden relative flex-1 min-h-0">
          <div className="h-full typeform-widget-container">
            <Widget
              className="w-full"
              id={
                type === 'citizen'
                  ? (process.env.NEXT_PUBLIC_TYPEFORM_CITIZEN_APP_FORM_ID as string)
                  : (process.env.NEXT_PUBLIC_TYPEFORM_TEAM_APP_FORM_ID as string)
              }
              onSubmit={submitTypeform}
              height={600}
            />
          </div>
          {/* Visible indicator for scroll/navigation */}
          <div className="absolute bottom-4 right-4 bg-blue-600/80 text-white text-xs px-3 py-1 rounded-full backdrop-blur-sm border border-blue-400/30 shadow-lg pointer-events-none opacity-75 scroll-indicator">
            ↕️ Scroll for more
          </div>
        </div>
      </div>
    </Modal>
  )
}
