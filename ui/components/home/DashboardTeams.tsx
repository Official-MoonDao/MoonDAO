import { useActiveAccount } from 'thirdweb/react'
import { useTeamWearer } from '@/lib/hats/useTeamWearer'
import { Hat } from '../hats/Hat'
import { LoadingSpinner } from '../layout/LoadingSpinner'
import StandardButton from '../layout/StandardButton'

export default function DashboardTeams({
  selectedChain,
  hatsContract,
  teamContract,
}: {
  selectedChain: any
  hatsContract: any
  teamContract: any
}) {
  const account = useActiveAccount()
  const address = account?.address
  const { userTeams: hats, isLoading } = useTeamWearer(
    teamContract,
    selectedChain,
    address
  )

  if (!isLoading && !hats)
    return (
      <div>
        <p className="text-gray-400 text-sm text-center py-2">
          You are not a member of any teams.
        </p>
        <StandardButton link="/team" className="w-full">
          Create a Team
        </StandardButton>
      </div>
    )
  return (
    <>
      {!isLoading && hats ? (
        <div className="flex flex-col lg:flex-row gap-4 max-h-[400px] overflow-y-auto md:overflow-y-hidden md:overflow-x-auto">
          {hats?.map((hat: any, index: number) => (
            <div
              key={hat.id || `hat-${index}`}
              className="bg-slate-600/20 rounded-xl p-2 hover:bg-slate-600/30 transition-colors"
            >
              <Hat
                selectedChain={selectedChain}
                hat={hat}
                hatsContract={hatsContract}
                teamImage
                teamContract={teamContract}
                compact
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-gray-400 text-sm text-center py-4">
          <LoadingSpinner />
        </div>
      )}
    </>
  )
}
