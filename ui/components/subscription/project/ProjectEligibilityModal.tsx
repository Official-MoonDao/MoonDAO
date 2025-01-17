import { XMarkIcon } from '@heroicons/react/24/outline'
import Modal from '@/components/layout/Modal'

export default function ProjectEligibilityModal({ setEnabled }: any) {
  return (
    <Modal id="team-manage-members-modal" setEnabled={setEnabled}>
      <div className="w-full rounded-[2vmax] flex flex-col gap-2 items-start justify-start w-auto md:w-[500px] p-5 py-0 bg-gradient-to-b from-dark-cool to-darkest-cool h-screen md:h-auto">
        <div className="w-full flex mt-5 mb-2 items-end justify-between">
          <h2 className="font-GoodTimes">{`Change Project Eligibility`}</h2>
          <button
            type="button"
            className="flex h-10 w-10 border-2 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
            onClick={() => setEnabled(false)}
          >
            <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
          </button>
        </div>
      </div>
    </Modal>
  )
}
