//This modal is used to inform the user that they need to be a manager of a team to create a mission
import { XMarkIcon } from '@heroicons/react/20/solid'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Modal from '../layout/Modal'
import TeamTier from '../onboarding/TeamTier'

export default function TeamRequirementModal({ setStatus }: any) {
  const router = useRouter()

  return (
    <Modal
      id="team-requirement-modal"
      setEnabled={() => {
        setStatus('idle')
      }}
    >
      <div className="mt-12 w-screen h-full rounded-[2vmax] max-w-full md:max-w-[800px] flex flex-col gap-4 items-start justify-start p-5 bg-gradient-to-b from-dark-cool to-darkest-cool">
        <div className="w-full flex gap-4 items-start justify-between">
          <h3 className="text- font-GoodTimes">{`Team Required`}</h3>
          <button
            type="button"
            className="flex h-10 w-10 border-2 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
            onClick={() => {
              setStatus('idle')
            }}
          >
            <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
          </button>
        </div>
        <p>{`You need to be a manager of a team to create a mission. Please create a team or join one as a manager to continue.`}</p>
        <Link href="/team" passHref>
          <TeamTier setSelectedTier={() => {}} compact />
        </Link>
      </div>
    </Modal>
  )
}
