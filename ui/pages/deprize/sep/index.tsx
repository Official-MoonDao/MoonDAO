import type { GetServerSideProps } from 'next'
import DePrizeIndexContent from '@/components/deprize/DePrizeIndexContent'
import { DePrizeRestrictedProvider } from '@/lib/deprize/deprizeRestrictedContext'
import { resolveDePrizePageProps, type DePrizePageProps } from '@/lib/deprize/pageEligibility'

// Own page module. Re-exporting `pages/deprize/index` made Next treat this URL
// as `/deprize` and recompile that page on every request, so the tab never
// finished loading.
export default function DePrizeSepoliaIndexPage({ restricted }: DePrizePageProps) {
  return (
    <DePrizeRestrictedProvider restricted={restricted}>
      <DePrizeIndexContent restricted={restricted} />
    </DePrizeRestrictedProvider>
  )
}

export const getServerSideProps: GetServerSideProps<DePrizePageProps> = async ({ req, res }) =>
  resolveDePrizePageProps(req, res)
