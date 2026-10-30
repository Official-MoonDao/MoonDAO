import StepFlow, { FlowStep } from '@/components/layout/StepFlow'

type ProjectSystemFlowProps = {
  isSenateVote: boolean
  isMemberVote: boolean
  rewardVotingActive: boolean
}

function getPhases({
  isSenateVote,
  isMemberVote,
  rewardVotingActive,
}: ProjectSystemFlowProps): FlowStep[] {
  return [
    {
      id: 'submit',
      label: 'Submit',
      subtitle: 'Proposal',
      live: !isSenateVote && !isMemberVote,
      description:
        'Anyone can submit a project proposal through the proposal portal. Each proposal lays out the problem, the solution, the team, and a requested budget. A winner receives min(their ask, ¼ of the quarterly pot). Proposals can be edited at any time leading up to the Townhall.',
      iconPath: 'M15.232 5.232l3.536 3.536M9 13h3l8-8a2.828 2.828 0 00-4-4l-8 8v3zM5 19h14',
    },
    {
      id: 'present',
      label: 'Present',
      subtitle: 'Townhall',
      live: false,
      description:
        "At the quarterly Townhall, every proposal gets a chance to pitch to the community. Each project has 10 minutes to walk through the problem they're solving, their proposed solution, the team, and the budget, followed by Q&A from the community.",
      iconPath:
        'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z',
    },
    {
      id: 'senate',
      label: 'Senate',
      subtitle: 'Review',
      live: isSenateVote,
      description:
        'After the Townhall, the Senate votes to approve or reject each proposal under the rules in the Constitution. Each Senator has one vote. Approval requires a super-majority (more than 66.6%) of Senate votes in favor, with a quorum of at least 70% of all Senators participating. Only proposals that pass the Senate advance to the Member Vote.',
      iconPath: 'M12 3l8 4v5c0 4.418-3.582 8-8 9-4.418-1-8-4.582-8-9V7l8-4z',
    },
    {
      id: 'member',
      label: 'Member',
      subtitle: 'Vote',
      live: isMemberVote,
      description:
        'Once the Senate has approved proposals, voting members distribute their voting power across the approved proposals as percentages. The top three by voting power are funded at min(ask, ¼ of the pot). If fewer than three Senate-passed proposals are considered, all of them are funded. Project authors, managers and members cannot vote on their own project.',
      iconPath: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    },
    {
      id: 'build',
      label: 'Build',
      subtitle: 'Execute',
      live: false,
      description:
        "Funded teams execute the project over the quarter, with budgets paid through the project's multisig. Leads give monthly written updates to the Senate and attend weekly Townhalls; Contributors post weekly progress in the #wdygdtw Discord channel. Missed updates and townhalls reduce retroactive rewards.",
      iconPath: 'M13 10V3L4 14h7v7l9-11h-7z',
    },
    {
      id: 'retro',
      label: 'Retroactive',
      subtitle: 'Rewards',
      live: isMemberVote && rewardVotingActive,
      description:
        'At the end of the quarter, each completed project submits a Final Report with its contributor split. Citizens and Voting Members then allocate their voting power across the projects to determine retroactive ETH and vMOONEY rewards based on impact.',
      iconPath:
        'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    },
  ]
}

export default function ProjectSystemFlow(props: ProjectSystemFlowProps) {
  return <StepFlow steps={getPhases(props)} />
}
