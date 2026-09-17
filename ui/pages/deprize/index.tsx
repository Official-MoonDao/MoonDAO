import type { GetServerSideProps } from 'next'
import { resolveDePrizePageProps, type DePrizePageProps } from '@/lib/deprize/pageEligibility'
import { DePrizeRestrictedProvider } from '@/lib/deprize/deprizeRestrictedContext'
import DePrizeIndexContent from '@/components/deprize/DePrizeIndexContent'

export default function DePrizeIndexPage({ restricted }: DePrizePageProps) {
  return (
    <DePrizeRestrictedProvider restricted={restricted}>
      <DePrizeIndexContent restricted={restricted} />
    </DePrizeRestrictedProvider>
  )
}

export const getServerSideProps: GetServerSideProps<DePrizePageProps> = async ({ req, res }) =>
  resolveDePrizePageProps(req, res)
