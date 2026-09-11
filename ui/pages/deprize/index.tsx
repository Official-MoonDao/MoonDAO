import type { GetServerSideProps } from 'next'
import { resolveDePrizePageProps, type DePrizePageProps } from '@/lib/deprize/pageEligibility'
import DePrizeIndexContent from '@/components/deprize/DePrizeIndexContent'

export default function DePrizeIndexPage() {
  return <DePrizeIndexContent />
}

export const getServerSideProps: GetServerSideProps<DePrizePageProps> = async ({ req, res }) =>
  resolveDePrizePageProps(req, res)
