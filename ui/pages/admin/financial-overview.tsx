import { usePrivy } from '@privy-io/react-auth'
import { useIsExecutive } from '@/lib/operator/useIsExecutive'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import Container from '../../components/layout/Container'
import ContentLayout from '../../components/layout/ContentLayout'
import WebsiteHead from '../../components/layout/Head'
import { NoticeFooter } from '../../components/layout/NoticeFooter'
import ExecutiveFinancials from '@/components/executive/ExecutiveFinancials'

// Executive-only financial overview. Gated to the `OPERATORS` allowlist in
// `const/config.ts` (pmoncada.eth, ryand2d.eth, miguel) on the client here and
// again on `/api/eb/financial-summary` via the `isOperator` middleware — the
// page shell carries no numbers of its own, so the API gate is the real one.
export default function FinancialOverview() {
  useChainDefault()
  const { authenticated, login } = usePrivy()
  const { isExecutive, status: authStatus } = useIsExecutive()

  const renderBody = () => {
    if (!authenticated) {
      return (
        <div className="bg-black/20 rounded-xl p-6 border border-white/10 text-center">
          <p className="text-gray-300 mb-4">
            Sign in with an Executive Branch wallet to view the financial overview.
          </p>
          <button
            type="button"
            onClick={() => login()}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium rounded-lg transition"
          >
            Sign In
          </button>
        </div>
      )
    }

    if (authStatus === 'loading' || authStatus === 'idle') {
      return (
        <div className="bg-black/20 rounded-xl p-6 border border-white/10 text-center text-gray-300">
          Checking Executive Branch access…
        </div>
      )
    }

    if (!isExecutive) {
      return (
        <div className="bg-black/20 rounded-xl p-6 border border-rose-400/30 text-center">
          <p className="text-rose-300">
            This wallet isn&apos;t authorized to view the financial overview. Access is limited to
            the Executive Branch.
          </p>
        </div>
      )
    }

    return <ExecutiveFinancials />
  }

  return (
    <>
      <WebsiteHead
        title="Financial Overview"
        description="Executive Branch financial overview — assets, burn rate, revenue, and runway."
      />
      <section className="flex flex-col justify-start px-5 mt-5 items-start animate-fadeIn w-[90vw] md:w-full">
        <Container>
          <ContentLayout
            header="Financial Overview"
            headerSize="40px"
            description="Assets, burn rate, revenue, and runway for the Executive Branch."
            mainPadding
            mode="compact"
            isProfile={true}
          >
            <div className="max-w-[1200px] w-full">{renderBody()}</div>
          </ContentLayout>
          <NoticeFooter />
        </Container>
      </section>
    </>
  )
}
