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
      <SubCard className="xl:h-[175px] flex flex-col gap-2 hover:ml-2 ease-in-out duration-300">
        <div className="flex gap-2">
          {icon}
          <p className="font-bold text-xl">{title}</p>
        </div>
        <p className="">{description}</p>
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
    <Card>
      <div className="mt-2 grid grid-cols-1 xl:grid-cols-3 gap-4">
        <TeamAction
          title="Fund"
          description="Submit a proposal to secure funding from the MoonDAO community for your space project."
          icon={<BanknotesIcon height={30} width={30} />}
          onClick={() => router.push('/newProposal')}
        />
        <TeamAction
          title="Hire"
          description="List job openings, contracts, and bounties to a global talent pool passionate about space."
          icon={<ClipboardDocumentListIcon height={30} width={30} />}
          onClick={() => setTeamJobModalEnabled(true)}
        />
        <TeamAction
          title="Sell"
          description="List products, services, or ticketed events for sale in ETH within the MoonDAO marketplace."
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
    </Card>
  )
}
