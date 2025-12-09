import { XMarkIcon } from '@heroicons/react/24/outline'
import Modal from '@/components/layout/Modal'
import { CompetitorPreview } from '@/components/nance/CompetitorPreview'
import Button from '../layout/Button'

type JoinDePrizeModalProps = {
  userTeams: any[]
  setJoinModalOpen: (open: boolean) => void
  teamContract: any
  handleJoinWithTeam: (teamId: string) => void
}

export function JoinDePrizeModal({
  userTeams,
  setJoinModalOpen,
  teamContract,
  handleJoinWithTeam,
}: JoinDePrizeModalProps) {
  return (
    <Modal id="join-deprize-modal" setEnabled={setJoinModalOpen}>
      <button
        id="close-modal"
        type="button"
        className="flex h-10 w-10 border-2 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
        onClick={() => setJoinModalOpen(false)}
      >
        <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
      </button>
      <div className="p-6">
        <h3 className="text-xl mb-4">Select a Team or Create a New One</h3>

        {/* Existing Teams */}
        {userTeams && userTeams.length > 0 && (
          <div className="mb-6">
            <h4 className="text-lg mb-2">Your Teams</h4>
            <div className="space-y-2">
              {userTeams.map((team: any) => (
                <button
                  key={team.teamId}
                  onClick={() => handleJoinWithTeam(team.teamId)}
                  className="w-full p-3 text-left hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <CompetitorPreview teamId={team.teamId} teamContract={teamContract} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Create New Team */}
        <div className="mt-4">
          <Button
            variant="gradient"
            borderRadius="rounded-full"
            className="w-full gradient-2"
            link="/team"
          >
            Create New Team
          </Button>
        </div>
      </div>
    </Modal>
  )
}
