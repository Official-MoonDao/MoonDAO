import { formatNumberUSStyle } from '@/lib/nance'
import { SnapshotGraphqlProposalVotingInfo } from '@/lib/snapshot'

export default function VotingInfo({
  votingInfo,
}: {
  votingInfo: SnapshotGraphqlProposalVotingInfo | undefined
}) {
  if (!votingInfo) return null

  const quorumProgress = (
    (votingInfo.scores_total * 100) /
    votingInfo.quorum
  ).toFixed(0)
  const quorumLabel =
    votingInfo.quorum !== 0 ? `${quorumProgress}% of quorum, ` : ''
  const scoresLabel = votingInfo.choices
    .map((choice, index) => {
      const score = votingInfo.state !== "closed" ? "🔐" : formatNumberUSStyle(votingInfo.scores[index], true);
      return `${choice} ${score}`
    })
    .slice(0, 3)
    .join(', ')

  return (
    <p className="flex flex-wrap gap-x-1 text-xs text-gray-400 font-RobotoMono">
      {`${quorumLabel}${scoresLabel} (${votingInfo.votes} voters)`}
    </p>
  )
}
