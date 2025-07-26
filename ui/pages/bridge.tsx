import React, { Suspense } from 'react'
import WebsiteHead from '../components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import Container from '@/components/layout/Container'
import ArbitrumBridge from '@/components/bridge/ArbitrumBridge'

// Loading Spinner Component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center py-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
  </div>
)

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error }
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('Bridge Error Boundary caught an error:', error, errorInfo)
  }

  render() {
    if ((this.state as any).hasError) {
      return (
        <div className="text-center py-8">
          <p className="text-red-400 mb-4">Something went wrong with the bridge component.</p>
          <button 
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try again
          </button>
        </div>
      )
    }

    return (this.props as any).children
  }
}

export default function Bridge() {
  return (
    <>
      <WebsiteHead 
        title="Bridge MOONEY Tokens - MoonDAO" 
        description="Bridge MOONEY tokens between Ethereum and Arbitrum for lower transaction fees." 
      />
      
      <Container is_fullwidth={true}>
        {/* Full-screen container with proper structure */}
        <div className="min-h-screen bg-dark-cool text-white w-full">
        
          {/* Simple Header */}
          <section className="py-16 px-6 w-full">
            <div className="max-w-7xl mx-auto text-center">
              <h1 className="text-4xl md:text-5xl font-bold font-GoodTimes text-white mb-4">
                Bridge MOONEY Tokens
              </h1>
              <p className="text-lg text-gray-300 max-w-2xl mx-auto">
                Transfer MOONEY tokens between Ethereum and Arbitrum networks.
              </p>
            </div>
          </section>

          {/* Bridge Interface */}
          <section className="pb-16 px-6 w-full">
            <div className="max-w-2xl mx-auto">
              <div className="bg-gradient-to-br from-gray-900/50 to-blue-900/20 rounded-xl p-6 border border-white/10">
                <ErrorBoundary>
                  <Suspense fallback={<LoadingSpinner />}>
                    <ArbitrumBridge />
                  </Suspense>
                </ErrorBoundary>
              </div>
            </div>
          </section>

          {/* Notice Footer */}
          <div className="w-full flex justify-center">
            <NoticeFooter 
              defaultTitle="Need Help?"
              defaultDescription="Submit a ticket in the support channel on MoonDAO's Discord!"
              defaultButtonText="Submit a Ticket"
              defaultButtonLink="https://discord.com/channels/914720248140279868/1212113005836247050"
              imageWidth={200}
              imageHeight={200}
            />
          </div>
        </div>
      </Container>
    </>
  )
}
