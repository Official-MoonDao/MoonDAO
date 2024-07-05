import {
  BanknotesIcon,
  BuildingStorefrontIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline'
import { useRouter } from 'next/router'
import { useState } from 'react'
import Card from './Card'
import SubCard from './SubCard'
import TeamJobModal from './TeamJobModal'
import TeamMarketplaceListingModal from './TeamMarketplaceListingModal'
import Frame from '../layout/Frame'

type TeamActionProps = {
  title: string
  description: string
  icon: any
  onClick?: () => void
}

type TeamActionsProps = {
  teamId: any
  jobTableContract: any
  marketplaceTableContract: any
}

function TeamAction({ title, description, icon, onClick }: TeamActionProps) {
  return (
    <button onClick={onClick}>
      <SubCard className=" flex flex-col gap-2 ease-in-out duration-300">
        <div className="flex gap-2">
          {icon}
          <p className="pb-2 font-bold text-xl">{title}</p>
        </div>
        <p className="pb-5">{description}</p>
      </SubCard>
    </button>
  )
}

export default function TeamActions({
  teamId,
  jobTableContract,
  marketplaceTableContract,
}: TeamActionsProps) {
  const router = useRouter()
  const [teamJobModalEnabled, setTeamJobModalEnabled] = useState(false)
  const [teamListingModalEnabled, setTeamListingModalEnabled] = useState(false)

  return (
    <div id="team-actions-container" 
      className="px-5 pt-5 md:px-0 md:pt-0"> 
      <Frame 
        noPadding 
        marginBottom='0px'
        bottomRight='2vmax'
        topRight='2vmax'
        topLeft='10px'
        bottomLeft='2vmax'
        >
        <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
          <TeamAction
            title="Fund"
            description="Submit a proposal to secure space project funding."
            icon={<BanknotesIcon height={30} width={30} />}
            onClick={() => router.push('/newProposal')}
          />
          <TeamAction
            title="Hire"
            description="List job openings or contracts to a global talent pool."
            icon={<ClipboardDocumentListIcon height={30} width={30} />}
            onClick={() => setTeamJobModalEnabled(true)}
          />
          <TeamAction
            title="Sell"
            description="List products, services, or ticketed events for sale."
            icon={<BuildingStorefrontIcon height={30} width={30} />}
            onClick={() => setTeamListingModalEnabled(true)}
          />
        </div>
        {teamJobModalEnabled && (
          <TeamJobModal
            teamId={teamId}
            jobTableContract={jobTableContract}
            setEnabled={setTeamJobModalEnabled}
            refreshJobs={() => router.reload()}
          />
        )}
        {teamListingModalEnabled && (
          <TeamMarketplaceListingModal
            teamId={teamId}
            marketplaceTableContract={marketplaceTableContract}
            setEnabled={setTeamListingModalEnabled}
            refreshListings={() => router.reload()}
          />
        )}
      </Frame>
    </div>   
  )
}
