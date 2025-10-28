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
      <p className="text-gray-400 text-sm text-center py-4">
        You are not a member of any teams.
      </p>
    )
  return (
    <>
      {!isLoading && hats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto auto-rows-auto">
          {hats?.map((hat: any) => (
            <div
              key={hat.id}
              className="bg-slate-600/20 rounded-xl p-4 hover:bg-slate-600/30 transition-colors"
            >
              <Hat
                selectedChain={selectedChain}
                hat={hat}
                hatsContract={hatsContract}
                teamImage
                teamContract={teamContract}
                vertical
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
