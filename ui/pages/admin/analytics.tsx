import { usePrivy } from '@privy-io/react-auth'
import { useIsExecutive } from '@/lib/operator/useIsExecutive'
import { useChainDefault } from '@/lib/thirdweb/hooks/useChainDefault'
import Container from '../../components/layout/Container'
import ContentLayout from '../../components/layout/ContentLayout'
import WebsiteHead from '../../components/layout/Head'
import { NoticeFooter } from '../../components/layout/NoticeFooter'
import AnalyticsDashboard from '@/components/executive/AnalyticsDashboard'

// Operator-only site analytics. Gated to the `OPERATORS` allowlist on the
// client here and again on `/api/operator/analytics` via `isOperator`, which
// is the real gate since the page shell carries no data of its own.
export default function Analytics() {
  useChainDefault()
  const { authenticated, login } = usePrivy()
  const { isExecutive, status: authStatus } = useIsExecutive()

  const renderBody = () => {
    if (!authenticated) {
      return (
        <div className="bg-black/20 rounded-xl p-6 border border-white/10 text-center">
          <p className="text-gray-300 mb-4">
            Sign in with an operator wallet to view site analytics.
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
          Checking operator access…
        </div>
      )
    }

    if (!isExecutive) {
      return (
        <div className="bg-black/20 rounded-xl p-6 border border-rose-400/30 text-center">
          <p className="text-rose-300">
            This wallet isn&apos;t authorized to view site analytics. Access is limited to MoonDAO
            operators.
          </p>
        </div>
      )
    }

    return <AnalyticsDashboard />
  }

  return (
    <>
      <WebsiteHead
        title="Site Analytics"
        description="Google Analytics overview for MoonDAO operators."
      />
      <section className="flex flex-col justify-start px-5 mt-5 items-start animate-fadeIn w-[90vw] md:w-full">
        <Container>
          <ContentLayout
            header="Site Analytics"
            headerSize="40px"
            description="Who's visiting moondao.com, how they find us, and what they do."
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
