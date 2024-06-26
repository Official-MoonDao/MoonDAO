import {
  BanknotesIcon,
  BuildingStorefrontIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline'
import { useRouter } from 'next/router'
import { useState } from 'react'
import Card from './Card'
import EntityJobModal from './EntityJobModal'
import EntityMarketplaceListingModal from './EntityMarketplaceListingModal'
import SubCard from './SubCard'

type EntityActionProps = {
  title: string
  description: string
  icon: any
  onClick?: () => void
}

type EntityActionsProps = {
  entityId: any
  jobTableContract: any
}

function EntityAction({
  title,
  description,
  icon,
  onClick,
}: EntityActionProps) {
  return (
    <button onClick={onClick}>
      <SubCard className="xl:h-[175px] flex flex-col gap-2 hover:scale-105 ease-in-out duration-300">
        <div className="flex gap-2">
          {icon}
          <p className="font-bold text-xl">{title}</p>
        </div>
        <p className="">{description}</p>
      </SubCard>
    </button>
  )
}

export default function EntityActions({
  entityId,
  jobTableContract,
  marketplaceTableContract,
}: any) {
  const router = useRouter()
  const [entityJobModalEnabled, setEntityJobModalEnabled] = useState(false)
  const [entityListingModalEnabled, setEntityListingModalEnabled] =
    useState(false)

  return (
    <Card>
      {/* <p className="text-2xl">Actions</p> */}
      <div className="mt-2 grid grid-cols-1 xl:grid-cols-3 gap-4">
        <EntityAction
          title="Fund"
          description="Submit a proposal to secure funding from the MoonDAO community for your space project."
          icon={<BanknotesIcon height={30} width={30} />}
          onClick={() => router.push('/newProposal')}
        />
        <EntityAction
          title="Hire"
          description="List job openings, contracts, and bounties to a global talent pool passionate about space."
          icon={<ClipboardDocumentListIcon height={30} width={30} />}
          onClick={() => setEntityJobModalEnabled(true)}
        />
        <EntityAction
          title="Sell"
          description="List products, services, or ticketed events for sale in ETH within the MoonDAO marketplace."
          icon={<BuildingStorefrontIcon height={30} width={30} />}
          onClick={() => setEntityListingModalEnabled(true)}
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
      {entityListingModalEnabled && (
        <EntityMarketplaceListingModal
          entityId={entityId}
          marketplaceTableContract={marketplaceTableContract}
          setEnabled={setEntityListingModalEnabled}
          refreshListings={() => router.reload()}
        />
      )}
    </Card>
  )
}
