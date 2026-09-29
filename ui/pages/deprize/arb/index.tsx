import type { GetServerSideProps } from 'next'
import DePrizeIndexContent from '@/components/deprize/DePrizeIndexContent'
import { DePrizeRestrictedProvider } from '@/lib/deprize/deprizeRestrictedContext'
import { resolveDePrizePageProps, type DePrizePageProps } from '@/lib/deprize/pageEligibility'

export default function DePrizeArbitrumIndexPage({ restricted }: DePrizePageProps) {
  return (
    <DePrizeRestrictedProvider restricted={restricted}>
      <DePrizeIndexContent restricted={restricted} />
    </DePrizeRestrictedProvider>
  )
}

export const getServerSideProps: GetServerSideProps<DePrizePageProps> = async ({ req, res }) =>
  resolveDePrizePageProps(req, res)
