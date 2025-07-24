import React, { useContext, useEffect, Suspense } from 'react'
import { useFundWallet } from '@privy-io/react-auth'
import { useRouter } from 'next/router'
import { useActiveAccount } from 'thirdweb/react'
import toast from 'react-hot-toast'
import Image from 'next/image'
import Link from 'next/link'
import { CheckCircleIcon, ShieldCheckIcon, UsersIcon, GlobeAltIcon, LockClosedIcon, ScaleIcon, ArrowRightIcon } from '@heroicons/react/24/outline'
import { ethereum } from '@/lib/infura/infuraChains'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import viemChains from '@/lib/viem/viemChains'
import { useMooneyTokenData } from '@/lib/hooks/useMooneyTokenData'
import WebsiteHead from '../components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import Container from '@/components/layout/Container'
import NetworkSelector from '@/components/thirdweb/NetworkSelector'
import NativeToMooney from '@/components/uniswap/NativeToMooney'
import ArbitrumBridge from '@/components/bridge/ArbitrumBridge'
import LockInterface from '../components/tokens/LockInterface'

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
    console.error('Component error:', error, errorInfo)
  }

  render() {
    if ((this.state as any).hasError) {
      return (
        <div className="p-6 bg-red-900/20 border border-red-500/50 rounded-lg">
          <h3 className="text-red-400 font-semibold mb-2">Component Error</h3>
          <p className="text-red-300 text-sm">This component failed to load. Please refresh the page or check your wallet connection.</p>
          <button 
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      )
    }

    return (this.props as any).children
  }
}

// Loading component
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
    </div>
  )
}

export default function Mooney() {
  const account = useActiveAccount()
  const address = account?.address
  const router = useRouter()
  const { selectedChain, setSelectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)
  const { fundWallet } = useFundWallet()
  
  // Live token data
  const { tokenData, loading, error, refetch } = useMooneyTokenData()

  return (
    <>
      <WebsiteHead 
        title="$MOONEY Token - MoonDAO Governance" 
        description="Learn about MOONEY, the governance token powering MoonDAO's mission to establish a lunar settlement. Buy, lock, and bridge MOONEY tokens to participate in decentralized space exploration governance." 
      />
      
      <Container is_fullwidth={true}>
        {/* Full-screen container with proper structure */}
        <div className="min-h-screen bg-dark-cool text-white w-full">
          
          {/* Hero Section */}
          <section className="relative py-20 px-6 w-full" style={{backgroundImage: 'url(/assets/MooneyHeroImg.jpg)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', imageRendering: 'crisp-edges'}}>
            <div className="absolute inset-0 bg-black/40"></div>
            <div className="max-w-7xl mx-auto text-center space-y-8 relative z-10">
              <div className="flex justify-center">
                <Image 
                  src="/coins/MOONEY.png" 
                  alt="MOONEY Token" 
                  width={120} 
                  height={120} 
                  className="rounded-full shadow-2xl"
                />
              </div>
              <div className="space-y-6">
                <h1 className="text-5xl md:text-7xl font-bold font-GoodTimes text-white">
                  MOONEY TOKEN
                </h1>
                
                {/* Live Price Display */}
                <div className="bg-black/20 backdrop-blur-sm rounded-xl p-4 border border-white/10 max-w-md mx-auto">
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-gray-300 text-lg">Live Price:</span>
                    <span className="text-white text-2xl font-bold font-mono">{tokenData.price}</span>
                    <span className={`text-sm font-medium ${tokenData.priceChange.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>
                      {tokenData.priceChange}
                    </span>
                    {loading && (
                      <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin"></div>
                    )}
                  </div>
                </div>
                
                <p className="text-xl md:text-2xl text-gray-300 max-w-4xl mx-auto leading-relaxed">
                  The governance token that powers MoonDAO's mission to create a self-sustaining, 
                  self-governing settlement on the Moon by 2030.
                </p>
                
                {/* Quick Navigation */}
                <div className="flex flex-wrap justify-center gap-4 pt-8">
                  <a href="#buy" className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all transform hover:scale-105">
                    Buy MOONEY
                  </a>
                  <a href="#lock" className="px-8 py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-all transform hover:scale-105">
                    Lock & Vote
                  </a>
                </div>
              </div>
            </div>
          </section>

        {/* Token Information Section */}
        <section className="py-16 px-6 bg-gradient-to-br from-gray-900/60 to-black/40 w-full">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-center gap-4 mb-12">
              <h2 className="text-3xl md:text-4xl font-bold font-GoodTimes text-center text-white">
                Token Information
              </h2>
              <div className="flex items-center gap-2">
                {loading && (
                  <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                )}
                <button
                  onClick={refetch}
                  className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors px-3 py-1 bg-blue-400/10 hover:bg-blue-400/20 rounded-lg border border-blue-400/20"
                  disabled={loading}
                >
                  {loading ? 'Updating...' : 'Refresh'}
                </button>
              </div>
            </div>
            
            {error && (
              <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 mb-6 text-center">
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}
            
            <div className="text-center mb-8">
              <p className="text-gray-400 text-sm">Last updated: {tokenData.lastUpdated}</p>
            </div>
            
            {/* Market Stats Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              <div className="bg-gradient-to-br from-gray-900/80 to-blue-900/40 rounded-xl p-6 border border-white/10 relative overflow-hidden">
                {loading && <div className="absolute inset-0 bg-blue-500/5 animate-pulse"></div>}
                <h3 className="text-blue-400 text-sm font-semibold mb-2">Market Cap</h3>
                <p className="text-white text-2xl font-bold">{tokenData.marketCap}</p>
                <p className={`text-sm ${tokenData.marketCapChange.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>
                  {tokenData.marketCapChange}
                </p>
              </div>
              
              <div className="bg-gradient-to-br from-gray-900/80 to-purple-900/40 rounded-xl p-6 border border-white/10 relative overflow-hidden">
                {loading && <div className="absolute inset-0 bg-purple-500/5 animate-pulse"></div>}
                <h3 className="text-purple-400 text-sm font-semibold mb-2">Total Supply</h3>
                <p className="text-white text-2xl font-bold">{tokenData.totalSupply}</p>
                <p className="text-gray-400 text-sm">MOONEY</p>
              </div>
              
              <div className="bg-gradient-to-br from-gray-900/80 to-green-900/40 rounded-xl p-6 border border-white/10 relative overflow-hidden">
                {loading && <div className="absolute inset-0 bg-green-500/5 animate-pulse"></div>}
                <h3 className="text-green-400 text-sm font-semibold mb-2">Circulating Supply</h3>
                <p className="text-white text-2xl font-bold">{tokenData.circulatingSupply}</p>
                <p className="text-gray-400 text-sm">{tokenData.circulatingPercent} of total</p>
              </div>
              
              <div className="bg-gradient-to-br from-gray-900/80 to-orange-900/40 rounded-xl p-6 border border-white/10 relative overflow-hidden">
                {loading && <div className="absolute inset-0 bg-orange-500/5 animate-pulse"></div>}
                <h3 className="text-orange-400 text-sm font-semibold mb-2">24h Volume</h3>
                <p className="text-white text-2xl font-bold">{tokenData.volume24h}</p>
                <p className={`text-sm ${tokenData.volumeChange.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>
                  {tokenData.volumeChange}
                </p>
              </div>
            </div>

            {/* Contract Addresses & Technical Info */}
            <div className="grid md:grid-cols-2 gap-8 mb-12">
              {/* Contract Addresses */}
              <div className="bg-gradient-to-br from-gray-900/50 to-blue-900/20 rounded-xl p-6 border border-white/10">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <LockClosedIcon className="h-5 w-5 text-blue-400" />
                  Contract Addresses
                </h3>
                <div className="space-y-4">
                  <div className="bg-black/20 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <img 
                        src="/icons/networks/ethereum.svg" 
                        alt="Ethereum" 
                        className="w-6 h-6"
                      />
                      <span className="text-white font-medium">Ethereum</span>
                    </div>
                    <code className="text-blue-300 text-sm break-all">0x20d4DB1946859E2Adb0e5ACC2eac58047aD41395</code>
                  </div>
                  <div className="bg-black/20 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <img 
                        src="/icons/networks/arbitrum.svg" 
                        alt="Arbitrum" 
                        className="w-6 h-6"
                      />
                      <span className="text-white font-medium">Arbitrum</span>
                    </div>
                    <code className="text-purple-300 text-sm break-all">0x1Fa56414549BdccBB09916f61f0A5827f779a85c</code>
                  </div>
                  <div className="bg-black/20 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <img 
                        src="/icons/networks/polygon.svg" 
                        alt="Polygon" 
                        className="w-6 h-6"
                      />
                      <span className="text-white font-medium">Polygon</span>
                    </div>
                    <code className="text-green-300 text-sm break-all">0x74ac7664abb1c8fa152d41bb60e311a663a41c7e</code>
                  </div>
                  <div className="bg-black/20 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <img 
                        src="/icons/networks/base.svg" 
                        alt="Base" 
                        className="w-6 h-6"
                      />
                      <span className="text-white font-medium">Base</span>
                    </div>
                    <code className="text-blue-300 text-sm break-all">0x6585a54A98fADA893904EB8A9E9CDFb927bddf39</code>
                  </div>
                </div>
              </div>

              {/* Quadratic Voting Formula */}
              <div className="bg-gradient-to-br from-gray-900/50 to-purple-900/20 rounded-xl p-6 border border-white/10">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <ScaleIcon className="h-5 w-5 text-purple-400" />
                  Quadratic Voting Formula
                </h3>
                <div className="space-y-4">
                  <div className="bg-black/20 rounded-lg p-4">
                    <h4 className="text-purple-300 font-semibold mb-2">Voting Power Calculation</h4>
                    <div className="bg-purple-500/10 rounded p-3 border border-purple-400/20">
                      <code className="text-purple-300 text-lg font-mono">Voting Power = √(vMOONEY)</code>
                    </div>
                  </div>
                  <div className="bg-black/20 rounded-lg p-4">
                    <h4 className="text-blue-300 font-semibold mb-2">Example</h4>
                    <div className="text-gray-300 text-sm space-y-1">
                      <p>10,000 vMOONEY = √10,000 = 100 voting power</p>
                      <p>1,000,000 vMOONEY = √1,000,000 = 1,000 voting power</p>
                    </div>
                  </div>
                  <div className="bg-green-500/10 rounded-lg p-3 border border-green-400/20">
                    <p className="text-green-300 text-sm">
                      💡 This prevents whale dominance in governance
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Treasury & Distribution */}
            <div className="bg-gradient-to-br from-gray-900/50 to-blue-900/20 rounded-xl p-6 border border-white/10">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <ShieldCheckIcon className="h-5 w-5 text-green-400" />
                Token Distribution & Treasury
              </h3>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                    <UsersIcon className="h-8 w-8 text-blue-400" />
                  </div>
                  <h4 className="text-white font-semibold mb-2">Community</h4>
                  <p className="text-blue-300 text-2xl font-bold">54%</p>
                  <p className="text-gray-400 text-sm">Circulating Supply</p>
                </div>
                
                <div className="text-center">
                  <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                    <LockClosedIcon className="h-8 w-8 text-purple-400" />
                  </div>
                  <h4 className="text-white font-semibold mb-2">Locked/Reserved</h4>
                  <p className="text-purple-300 text-2xl font-bold">46%</p>
                  <p className="text-gray-400 text-sm">Future distribution</p>
                </div>
                
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CheckCircleIcon className="h-8 w-8 text-green-400" />
                  </div>
                  <h4 className="text-white font-semibold mb-2">Fixed Supply</h4>
                  <p className="text-green-300 text-2xl font-bold">0%</p>
                  <p className="text-gray-400 text-sm">Inflation Rate</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Key Features Section */}
        <section className="py-20 px-6 bg-gradient-to-br from-gray-900/50 to-blue-900/20 w-full">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold font-GoodTimes text-center text-white mb-8">
              Key Features
            </h2>
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 rounded-xl p-6 border border-white/10">
                <div className="bg-blue-500/20 rounded-full w-12 h-12 flex items-center justify-center mb-4">
                  <ScaleIcon className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2 font-GoodTimes">Quadratic Voting</h3>
                <p className="text-gray-300 text-sm mb-3">
                  Lock MOONEY to get vMOONEY voting power. Influence = √(vMOONEY balance).
                </p>
              </div>
              
              <div className="bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 rounded-xl p-6 border border-white/10">
                <div className="bg-purple-500/20 rounded-full w-12 h-12 flex items-center justify-center mb-4">
                  <ShieldCheckIcon className="w-6 h-6 text-purple-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2 font-GoodTimes">Fixed Supply</h3>
                <p className="text-gray-300 text-sm mb-3">
                  Only 2.6B MOONEY will ever exist. No new tokens minted.
                </p>
              </div>
              
              <div className="bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 rounded-xl p-6 border border-white/10">
                <div className="bg-green-500/20 rounded-full w-12 h-12 flex items-center justify-center mb-4">
                  <GlobeAltIcon className="w-6 h-6 text-green-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2 font-GoodTimes">Multi-Chain</h3>
                <p className="text-gray-300 text-sm mb-3">
                  Available on Ethereum, Arbitrum, Polygon, and Base.
                </p>
                <div className="flex gap-1 flex-wrap">
                  <span className="text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded">ETH</span>
                  <span className="text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded">ARB</span>
                  <span className="text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded">MATIC</span>
                  <span className="text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded">BASE</span>
                </div>
              </div>
            </div>
            
            {/* Governance Flow Card */}
            <div className="bg-gradient-to-r from-black/40 via-blue-900/20 to-purple-900/20 rounded-2xl p-6 border border-white/10">
              <div className="grid md:grid-cols-4 gap-4 text-center">
                <div className="space-y-2">
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center mx-auto text-white font-bold">1</div>
                  <span className="text-blue-300 text-sm font-semibold">Get MOONEY</span>
                </div>
                <div className="space-y-2">
                  <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center mx-auto text-white font-bold">2</div>
                  <span className="text-purple-300 text-sm font-semibold">Lock for vMOONEY</span>
                </div>
                <div className="space-y-2">
                  <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center mx-auto text-white font-bold">3</div>
                  <span className="text-green-300 text-sm font-semibold">Vote on Proposals</span>
                </div>
                <div className="space-y-2">
                  <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center mx-auto text-white font-bold">4</div>
                  <span className="text-orange-300 text-sm font-semibold">Shape Mission</span>
                </div>
              </div>
              <div className="text-center mt-6">
                <code className="text-blue-300 font-mono text-lg">Voting Power = √(vMOONEY)</code>
                <p className="text-gray-400 text-sm mt-1">Quadratic voting prevents whale dominance</p>
              </div>
            </div>
          </div>
        </section>

        {/* Buy MOONEY Section */}
        <section id="buy" className="py-12 px-6 bg-gradient-to-br from-gray-900/50 to-blue-900/20 w-full">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl md:text-4xl font-bold font-GoodTimes text-white mb-4">
                Buy MOONEY
              </h2>
              <p className="text-lg text-gray-300 max-w-2xl mx-auto">
                Get MOONEY tokens by swapping from other cryptocurrencies.
              </p>
            </div>
            
            <div className="max-w-xl mx-auto space-y-6">
              <div className="bg-gradient-to-br from-gray-900/50 to-blue-900/20 rounded-xl p-4 border border-white/10">
                <ErrorBoundary>
                  <Suspense fallback={<LoadingSpinner />}>
                    <NetworkSelector />
                  </Suspense>
                </ErrorBoundary>
              </div>
              <div className="bg-gradient-to-br from-gray-900/50 to-purple-900/20 rounded-xl p-4 border border-white/10">
                <ErrorBoundary>
                  <Suspense fallback={<LoadingSpinner />}>
                    <NativeToMooney selectedChain={selectedChain} />
                  </Suspense>
                </ErrorBoundary>
              </div>
            </div>
          </div>
        </section>

        {/* Lock MOONEY Section */}
        <section id="lock" className="py-12 px-6 bg-gradient-to-br from-purple-900/20 to-gray-900/50 w-full">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl md:text-4xl font-bold font-GoodTimes text-white mb-4">
                Lock for Voting Power
              </h2>
              <p className="text-lg text-gray-300 max-w-2xl mx-auto">
                Lock MOONEY to receive vMOONEY and gain voting power in governance.
              </p>
            </div>
            
            <div className="max-w-xl mx-auto">
              <div className="bg-gradient-to-br from-gray-900/50 to-purple-900/20 rounded-xl p-4 border border-white/10">
                <ErrorBoundary>
                  <Suspense fallback={<LoadingSpinner />}>
                    <LockInterface />
                  </Suspense>
                </ErrorBoundary>
              </div>
            </div>
          </div>
        </section>

        {/* Call to Action Section */}
        <section className="py-16 px-6 bg-gradient-to-br from-purple-900/30 to-blue-900/30 w-full">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold text-white font-GoodTimes">
              Ready to Join the Mission?
            </h2>
            <p className="text-lg text-gray-300 max-w-3xl mx-auto">
              Get MOONEY, lock for voting power, and help shape humanity's space future.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="#buy"
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white py-3 px-8 rounded-xl text-lg font-semibold transition-all duration-200 transform hover:scale-[1.02] shadow-lg flex items-center gap-2 justify-center"
              >
                Get MOONEY <ArrowRightIcon className="w-5 h-5" />
              </a>
              <a
                href="#lock"
                className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white py-3 px-8 rounded-xl text-lg font-semibold transition-all duration-200 transform hover:scale-[1.02] shadow-lg flex items-center gap-2 justify-center"
              >
                Lock for Voting Power <ArrowRightIcon className="w-5 h-5" />
              </a>
              <Link
                href="/vote"
                className="bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 text-white py-3 px-8 rounded-xl text-lg font-semibold transition-all duration-200 transform hover:scale-[1.02] shadow-lg flex items-center gap-2 justify-center"
              >
                View Proposals <ArrowRightIcon className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="flex justify-center w-full">
          <NoticeFooter
            defaultImage="../assets/MoonDAO-Logo-White.svg"
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
