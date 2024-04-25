import { useNewestProposals } from '@/lib/snapshot/useNewestProposals'
import Button from './Button'
import Card from './Card'

export default function Proposals({ numberOfProposals = 3 }) {
  const newestProposals = useNewestProposals(numberOfProposals)
  return (
    <Card className="w-full flex flex-col justify-between">
      <p className="text-2xl">Governance</p>
      <div className="mt-2 flex flex-col gap-4">
        {newestProposals
          ? newestProposals.map((proposal: any) => (
              <div
                key={proposal.id}
                className="p-2 flex justify-between border-2 dark:border-0 dark:bg-[#0f152f] rounded-sm"
              >
                <div className="flex flex-col gap-2">
                  <p>{proposal.title}</p>
                </div>
                <p
                  className={`flex items-center justify-center px-4 h-8 rounded-full bg-opacity-25 ${
                    proposal.state === 'closed'
                      ? 'text-moon-orange bg-red-400'
                      : 'text-moon-green bg-moon-green'
                  }`}
                >
                  {proposal.state}
                </p>
              </div>
            ))
          : Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="w-full h-20 bg-[#ffffff25] animate-pulse"
              />
            ))}
      </div>
      <div className="mt-4 flex flex-col md:flex-row gap-2">
        <Button
          onClick={() =>
            window.open(
              'https://discord.com/channels/914720248140279868/1027658256706961509'
            )
          }
        >
          Create Proposals
        </Button>
        <Button
          onClick={() => window.open('https://snapshot.org/#/tomoondao.eth')}
        >
          Vote on Proposals
        </Button>
      </div>
    </Card>
  )
}
