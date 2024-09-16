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
      <div className="mt-32 w-full flex flex-col gap-2 items-start justify-start w-auto md:w-[650px] p-4 md:p-8 bg-darkest-cool rounded-md">
        <div className="w-full flex items-center justify-between">
          <div>
            <h2 className="font-GoodTimes">{'Apply'}</h2>
          </div>
          <button
            type="button"
            className="flex h-10 w-10 border-2 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
            onClick={() => setEnabled(false)}
          >
            <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
          </button>
        </div>
        <Widget
          className="w-full"
          id={
            type === 'citizen'
              ? (process.env.NEXT_PUBLIC_TYPEFORM_CITIZEN_APP_FORM_ID as string)
              : (process.env.NEXT_PUBLIC_TYPEFORM_TEAM_APP_FORM_ID as string)
          }
          onSubmit={submitTypeform}
          height={500}
        />
      </div>
    </Modal>
  )
}
