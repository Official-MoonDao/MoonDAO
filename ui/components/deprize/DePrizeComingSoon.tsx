import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'

/** Arbitrum mainnet teaser — full DePrize UI is Sepolia-first until mainnet deploy. */
export default function DePrizeComingSoon() {
  return (
    <div className="animate-fadeIn flex flex-col items-center">
      <Head
        title="DePrize"
        description="Open challenges with live odds. Coming soon on Arbitrum."
      />
      <Container>
        <ContentLayout
          header="DePrize"
          mainPadding
          mode="compact"
          popOverEffect={false}
          isProfile
          centerHeader
          centerHeaderWidth="760px"
          description=""
          preFooter={<NoticeFooter />}
        >
          <div className="w-full max-w-[760px] mx-auto">
            <div className="p-10 sm:p-14 rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-indigo-950/40 backdrop-blur-xl border border-white/[0.08] shadow-lg text-center">
              <p className="text-white font-GoodTimes text-2xl sm:text-3xl tracking-wide">
                Coming soon!
              </p>
            </div>
          </div>
        </ContentLayout>
      </Container>
    </div>
  )
}
