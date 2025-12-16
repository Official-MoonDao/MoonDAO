//This modal is used to inform the user that they need to be a manager of a team to create a mission
import Link from 'next/link'
import { useRouter } from 'next/router'
import Modal from '../layout/Modal'
import TeamTier from '../onboarding/TeamTier'

export default function TeamRequirementModal({ setStatus, setEnabled }: any) {
  const router = useRouter()

  const handleClose = () => {
    router.reload()
  }

  return (
    <Modal id="team-requirement-modal" setEnabled={handleClose} title="Team Required" size="2xl">
      <div className="flex flex-col gap-4 items-start justify-start">
        <p>{`You need to be a manager of a team to create a mission. Please create a team or join one as a manager to continue.`}</p>
        <Link href="/team" passHref>
          <TeamTier setSelectedTier={() => {}} compact />
        </Link>
      </div>
    </Modal>
  )
}
