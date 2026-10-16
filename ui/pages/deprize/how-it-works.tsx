import type { GetServerSideProps } from 'next'
import { DePrizeRestrictedProvider } from '@/lib/deprize/deprizeRestrictedContext'
import { resolveDePrizePageProps, type DePrizePageProps } from '@/lib/deprize/pageEligibility'
import DePrizeHowItWorks from '@/components/deprize/howItWorks/DePrizeHowItWorks'

export default function DePrizeHowItWorksPage({ restricted }: DePrizePageProps) {
  return (
    <DePrizeRestrictedProvider restricted={restricted}>
      <DePrizeHowItWorks restricted={restricted} />
    </DePrizeRestrictedProvider>
  )
}

export const getServerSideProps: GetServerSideProps<DePrizePageProps> = async ({ req, res }) =>
  resolveDePrizePageProps(req, res)
