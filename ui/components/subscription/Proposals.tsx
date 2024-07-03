import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useNewestProposals } from '@/lib/snapshot/useNewestProposals'
import StandardButton from '../layout/StandardButton'
import Button from './Button'
import Card from './Card'

export default function Proposals({ numberOfProposals = 3 }) {
  const router = useRouter()
  const newestProposals = useNewestProposals(numberOfProposals)
  return (
    <Card className="w-full flex flex-col justify-between">
      <div className="flex gap-5 opacity-[50%]">
        <Image
          src="/assets/icon-governance.svg"
          width={30}
          height={30}
          alt="Governance icon"
        />
        <p className="header font-GoodTimes">Governance</p>
      </div>
      <div className="mt-2 flex flex-col gap-4">
        {newestProposals
          ? newestProposals.map((proposal: any) => (
              <Link
                key={proposal.id}
                className="w-[95%] p-2 flex justify-between border-2 dark:border-0 dark:bg-[#0f152f] rounded-sm hover:scale-105 duration-300 ease-in-out"
                href={`https://snapshot.org/#/tomoondao.eth/proposal/${proposal.id}`}
                target="_blank"
                rel="noreferrer noopener"
                passHref
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
              </Link>
            ))
          : Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="w-full h-20 bg-[#ffffff25] animate-pulse"
              />
            ))}
      </div>
      <div className="mt-4 flex flex-col md:flex-row gap-2">
        <StandardButton
          className="gradient-2"
          onClick={() => router.push('/newProposal')}
        >
          Create a Proposal
        </StandardButton>
        <StandardButton
          className="gradient-2"
          onClick={() => router.push('/vote')}
        >
          Vote on Proposals
        </StandardButton>
      </div>
    </Card>
  )
}
