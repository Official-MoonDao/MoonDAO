import type { GetServerSideProps } from 'next'
import DePrizeIndexContent from '@/components/deprize/DePrizeIndexContent'
import DePrizeRestrictedNotice from '@/components/deprize/DePrizeRestrictedNotice'
import {
  resolveDePrizePageProps,
  type DePrizePageProps,
} from '@/lib/deprize/pageEligibility'

export default function DePrizeIndexPage({ restricted }: DePrizePageProps) {
  if (restricted) return <DePrizeRestrictedNotice />
  return <DePrizeIndexContent />
}

export const getServerSideProps: GetServerSideProps<DePrizePageProps> = async ({
  req,
  res,
}) => resolveDePrizePageProps(req, res)
