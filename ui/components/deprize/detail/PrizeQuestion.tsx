import DePrizeQuestionCard from '@/components/deprize/DePrizeQuestionCard'

export default function PrizeQuestion({
  tagline,
  description,
  criteria,
  moonbaseHref,
}: {
  tagline?: string
  description?: string
  criteria?: string
  moonbaseHref?: string
}) {
  return (
    <DePrizeQuestionCard
      tagline={tagline}
      description={description}
      criteria={criteria}
      moonbaseHref={moonbaseHref}
    />
  )
}
