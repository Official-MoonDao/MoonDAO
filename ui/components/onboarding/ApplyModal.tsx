//Modal for tier application typeform
import { XMarkIcon } from '@heroicons/react/24/outline'
import { Widget } from '@typeform/embed-react'
import { useCallback } from 'react'
import toast from 'react-hot-toast'
import Modal from '../layout/Modal'

type ApplyModalProps = {
  type: string
  setEnabled: (enabled: boolean) => void
}

export default function ApplyModal({ type, setEnabled }: ApplyModalProps) {
  const submitTypeform = useCallback(async () => {
    toast.success('Application submitted!')
    setEnabled(false)
  }, [setEnabled])

  return (
    <Modal id="apply-modal-backdrop" setEnabled={setEnabled}>
      <div className="w-[95vw] md:w-[700px] flex flex-col gap-4 md:gap-6 p-4 md:p-8 bg-gradient-to-b from-slate-800/90 to-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-2xl md:rounded-[2vmax] shadow-2xl max-h-[90vh] md:max-h-[85vh]">
        <div className="w-full flex items-start md:items-center justify-between flex-shrink-0 gap-4">
          <div className="flex flex-col gap-1 md:gap-2 flex-1 min-w-0">
            <h2 className="text-xl md:text-2xl font-GoodTimes text-white">Apply to MoonDAO</h2>
            <p className="text-slate-300 text-xs md:text-sm">
              Complete the application form below to join our community
            </p>
          </div>
          <button
            type="button"
            className="flex h-10 w-10 border-2 border-slate-600 items-center justify-center rounded-full hover:border-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white flex-shrink-0"
            onClick={() => setEnabled(false)}
            aria-label="Close modal"
          >
            <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
          </button>
        </div>
        <div className="w-full bg-gradient-to-b from-slate-700/30 to-slate-800/40 rounded-xl md:rounded-2xl border border-slate-600/30 overflow-hidden relative">
          <div className="min-h-[400px] md:min-h-[500px] max-h-[65vh] typeform-widget-container">
            <Widget
              className="w-full h-full"
              id={
                type === 'citizen'
                  ? (process.env.NEXT_PUBLIC_TYPEFORM_CITIZEN_APP_FORM_ID as string)
                  : (process.env.NEXT_PUBLIC_TYPEFORM_TEAM_APP_FORM_ID as string)
              }
              onSubmit={submitTypeform}
            />
          </div>
          <div className="absolute bottom-4 right-4 bg-blue-600/80 text-white text-xs px-3 py-1 rounded-full backdrop-blur-sm border border-blue-400/30 shadow-lg pointer-events-none opacity-75">
            ↕️ Scroll for more
          </div>
        </div>
      </div>
    </Modal>
  )
}
