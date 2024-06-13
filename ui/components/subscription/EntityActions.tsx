import {
  BanknotesIcon,
  BuildingStorefrontIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline'
import { useRouter } from 'next/router'
import { useState } from 'react'
import Card from './Card'
import EntityJobModal from './EntityJobModal'
import SubCard from './SubCard'

type EntityActionProps = {
  title: string
  icon: any
  onClick?: () => void
}

type EntityActionsProps = {
  entityId: any
  jobTableContract: any
}

function EntityAction({ title, icon, onClick }: EntityActionProps) {
  return (
    <button onClick={onClick}>
      <SubCard className="flex gap-2 hover:scale-105 ease-in-out duration-300">
        {icon}
        <p className="font-bold">{title}</p>
      </SubCard>
    </button>
  )
}

export default function EntityActions({ entityId, jobTableContract }: any) {
  const router = useRouter()
  const [entityJobModalEnabled, setEntityJobModalEnabled] = useState(false)

  return (
    <Card>
      {/* <p className="text-2xl">Actions</p> */}
      <div className="mt-2 grid grid-cols-1 xl:grid-cols-3 gap-4">
        <EntityAction
          title="Get Funding from MoonDAO"
          icon={<BanknotesIcon height={24} width={24} />}
        />
        <EntityAction
          title="Post a Job"
          icon={<ClipboardDocumentListIcon height={24} width={24} />}
          onClick={() => setEntityJobModalEnabled(true)}
        />
        <EntityAction
          title="List a Product or Service"
          icon={<BuildingStorefrontIcon height={24} width={24} />}
        />
      </div>
      {entityJobModalEnabled && (
        <EntityJobModal
          entityId={entityId}
          jobTableContract={jobTableContract}
          setEnabled={setEntityJobModalEnabled}
          refreshJobs={() => router.reload()}
        />
      )}
    </Card>
  )
}
