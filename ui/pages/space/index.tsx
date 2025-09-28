import {
  RocketLaunchIcon,
  ExclamationTriangleIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
} from '@heroicons/react/24/outline'
import { getAccessToken, usePrivy } from '@privy-io/react-auth'
import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { useContext } from 'react'
import { useActiveAccount } from 'thirdweb/react'
import CitizenContext from '@/lib/citizen/citizen-context'
import Container from '@/components/layout/Container'

export default function Space() {
  const { authenticated, login } = usePrivy()
  const account = useActiveAccount()
  const { citizen, isLoading } = useContext(CitizenContext)
  const [token, setToken] = useState<string | null>(null)
  const [iframeSrc, setIframeSrc] = useState<string | null>(null)
  const [isLoadingToken, setIsLoadingToken] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const gameContainerRef = useRef<HTMLDivElement>(null)

  const walletAddress = useMemo(() => {
    return (citizen?.owner || account?.address || '').toString()
  }, [citizen, account])

  const citizenName = useMemo(() => {
    return (
      citizen?.metadata?.name ||
      citizen?.name ||
      (walletAddress
        ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
        : '')
    )
  }, [citizen, walletAddress])

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      const isMobileDevice =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        ) ||
        window.innerWidth <= 768 ||
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0
      setIsMobile(isMobileDevice)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Fullscreen detection
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () =>
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const toggleFullscreen = useCallback(async () => {
    if (!gameContainerRef.current) return

    try {
      if (!document.fullscreenElement) {
        await gameContainerRef.current.requestFullscreen()
      } else {
        await document.exitFullscreen()
      }
    } catch (error) {
      console.error('Fullscreen toggle failed:', error)
    }
  }, [])

  // Keyboard escape handler
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && document.fullscreenElement) {
        document.exitFullscreen()
      }
    }

    document.addEventListener('keydown', handleKeyPress)
    return () => document.removeEventListener('keydown', handleKeyPress)
  }, [])

  useEffect(() => {
    async function fetchToken() {
      if (!authenticated) return
      if (!citizen || !walletAddress) return

      setIsLoadingToken(true)
      setHasError(false)

      try {
        const accessToken = await getAccessToken()
        const res = await fetch('/api/space/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken: accessToken }),
        })
        if (!res.ok) throw new Error('Failed to fetch token')
        const data = await res.json()
        setToken(data.token)
        setHasError(false)
      } catch (e) {
        console.error(e)
        setToken(null)
        setHasError(true)
      } finally {
        setIsLoadingToken(false)
      }
    }
    fetchToken()
  }, [authenticated, citizen, walletAddress, citizenName])

  // Build iframe src once token is ready (client-side only)
  useEffect(() => {
    if (!token) return
    if (typeof window === 'undefined') return
    try {
      setIframeSrc(
        `/space-client/index.html#token=${encodeURIComponent(token)}`
      )
    } catch {
      setIframeSrc(
        `/space-client/index.html#token=${encodeURIComponent(token)}`
      )
    }
  }, [token])

  // Auto-fullscreen on mobile when game loads
  useEffect(() => {
    if (!iframeSrc || !isMobile || !gameContainerRef.current) return

    const timer = setTimeout(async () => {
      if (gameContainerRef.current && !document.fullscreenElement) {
        try {
          await gameContainerRef.current.requestFullscreen()
        } catch (error) {
          console.log('Auto-fullscreen failed on mobile:', error)
        }
      }
    }, 1000) // Small delay to ensure iframe is loaded

    return () => clearTimeout(timer)
  }, [iframeSrc, isMobile])

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-darkest-cool via-dark-cool to-mid-cool relative overflow-hidden">
        {/* Background gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-dark-warm/20 via-transparent to-transparent" />

        {/* Animated background elements */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-light-cool/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-moon-gold/10 rounded-full blur-3xl animate-pulse delay-1000" />

        <Container>
          <div className="min-h-screen flex items-center justify-center relative z-10">
            <div className="w-full max-w-md mx-auto">
              <div className="bg-gradient-to-b from-slate-800/40 to-slate-900/60 backdrop-blur-xl border border-slate-700/30 rounded-3xl p-8 shadow-2xl">
                <div className="text-center space-y-6">
                  <div className="mx-auto w-16 h-16 bg-gradient-to-br from-light-cool to-moon-gold rounded-full flex items-center justify-center mb-4">
                    <RocketLaunchIcon className="w-8 h-8 text-white" />
                  </div>

                  <h1 className="text-3xl font-GoodTimes text-white mb-4">
                    Welcome to Space
                  </h1>

                  <p className="text-slate-300 text-lg leading-relaxed">
                    Connect your wallet to access the MoonDAO Space experience
                  </p>

                  <button
                    onClick={() => login?.()}
                    className="w-full py-4 px-6 bg-gradient-to-r from-light-cool to-moon-gold hover:from-light-cool/90 hover:to-moon-gold/90 text-white font-semibold rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-light-cool/50 focus:ring-offset-2 focus:ring-offset-slate-900"
                  >
                    Connect Wallet
                  </button>

                  <div className="flex items-center justify-center space-x-2 text-sm text-slate-400">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span>Secure Web3 Authentication</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </div>
    )
  }

  if (isLoading || isLoadingToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-darkest-cool via-dark-cool to-mid-cool relative overflow-hidden">
        {/* Background gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-dark-warm/20 via-transparent to-transparent" />

        {/* Animated background elements */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-light-cool/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-moon-gold/10 rounded-full blur-3xl animate-pulse delay-1000" />

        <Container>
          <div className="min-h-screen flex items-center justify-center relative z-10">
            <div className="w-full max-w-md mx-auto">
              <div className="bg-gradient-to-b from-slate-800/40 to-slate-900/60 backdrop-blur-xl border border-slate-700/30 rounded-3xl p-8 shadow-2xl">
                <div className="text-center space-y-6">
                  {/* Loading spinner */}
                  <div className="mx-auto w-16 h-16 relative">
                    <div className="absolute inset-0 rounded-full border-4 border-slate-600"></div>
                    <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-light-cool animate-spin"></div>
                  </div>

                  <h2 className="text-2xl font-GoodTimes text-white">
                    Verifying Access
                  </h2>

                  <p className="text-slate-300 text-lg">
                    Checking your Citizen NFT…
                  </p>

                  {/* Progress dots */}
                  <div className="flex justify-center space-x-2">
                    <div className="w-2 h-2 bg-light-cool rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-light-cool rounded-full animate-pulse delay-150"></div>
                    <div className="w-2 h-2 bg-light-cool rounded-full animate-pulse delay-300"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </div>
    )
  }

  if (!citizen) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-darkest-cool via-dark-cool to-mid-cool relative overflow-hidden">
        {/* Background gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-dark-warm/20 via-transparent to-transparent" />

        {/* Animated background elements */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-light-cool/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-moon-gold/10 rounded-full blur-3xl animate-pulse delay-1000" />

        <Container>
          <div className="min-h-screen flex items-center justify-center relative z-10">
            <div className="w-full max-w-md mx-auto">
              <div className="bg-gradient-to-b from-slate-800/40 to-slate-900/60 backdrop-blur-xl border border-slate-700/30 rounded-3xl p-8 shadow-2xl">
                <div className="text-center space-y-6">
                  <div className="mx-auto w-16 h-16 bg-gradient-to-br from-moon-orange/20 to-red-500/20 rounded-full flex items-center justify-center mb-4 border border-moon-orange/30">
                    <ExclamationTriangleIcon className="w-8 h-8 text-moon-orange" />
                  </div>

                  <h1 className="text-3xl font-GoodTimes text-white mb-4">
                    Access Restricted
                  </h1>

                  <div className="space-y-4">
                    <h2 className="text-xl font-semibold text-white">
                      Citizen NFT Required
                    </h2>
                    <p className="text-slate-300 text-lg leading-relaxed">
                      You need a MoonDAO Citizen NFT to access the Space
                      experience. Join our community and unlock exclusive
                      features.
                    </p>
                  </div>

                  <div className="pt-4">
                    <a
                      href="/citizen"
                      className="inline-block w-full py-4 px-6 bg-gradient-to-r from-moon-orange to-red-500 hover:from-moon-orange/90 hover:to-red-500/90 text-white font-semibold rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-moon-orange/50 focus:ring-offset-2 focus:ring-offset-slate-900"
                    >
                      Get Citizen NFT
                    </a>
                  </div>

                  <div className="flex items-center justify-center space-x-2 text-sm text-slate-400">
                    <div className="w-2 h-2 bg-moon-orange rounded-full animate-pulse" />
                    <span>Exclusive Access Required</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </div>
    )
  }

  if (hasError || (token && !iframeSrc)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-darkest-cool via-dark-cool to-mid-cool relative overflow-hidden">
        {/* Background gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-dark-warm/20 via-transparent to-transparent" />

        {/* Animated background elements */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-light-cool/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-moon-gold/10 rounded-full blur-3xl animate-pulse delay-1000" />

        <Container>
          <div className="min-h-screen flex items-center justify-center relative z-10">
            <div className="w-full max-w-md mx-auto">
              <div className="bg-gradient-to-b from-slate-800/40 to-slate-900/60 backdrop-blur-xl border border-slate-700/30 rounded-3xl p-8 shadow-2xl">
                <div className="text-center space-y-6">
                  <div className="mx-auto w-16 h-16 bg-gradient-to-br from-red-500/20 to-moon-orange/20 rounded-full flex items-center justify-center mb-4 border border-red-500/30">
                    <ExclamationTriangleIcon className="w-8 h-8 text-red-400" />
                  </div>

                  <h1 className="text-3xl font-GoodTimes text-white mb-4">
                    Connection Error
                  </h1>

                  <p className="text-slate-300 text-lg leading-relaxed">
                    Failed to load Space. Please try refreshing the page or
                    contact support if the issue persists.
                  </p>

                  <div className="pt-4">
                    <button
                      onClick={() => window.location.reload()}
                      className="w-full py-4 px-6 bg-gradient-to-r from-red-500 to-moon-orange hover:from-red-500/90 hover:to-moon-orange/90 text-white font-semibold rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:ring-offset-2 focus:ring-offset-slate-900"
                    >
                      Retry Connection
                    </button>
                  </div>

                  <div className="flex items-center justify-center space-x-2 text-sm text-slate-400">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    <span>Connection Failed</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </div>
    )
  }

  // Only show the game when we have both token and iframe src ready
  if (!token || !iframeSrc) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-darkest-cool via-dark-cool to-mid-cool relative overflow-hidden">
        {/* Background gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-dark-warm/20 via-transparent to-transparent" />

        {/* Animated background elements */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-light-cool/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-moon-gold/10 rounded-full blur-3xl animate-pulse delay-1000" />

        <Container>
          <div className="min-h-screen flex items-center justify-center relative z-10">
            <div className="w-full max-w-md mx-auto">
              <div className="bg-gradient-to-b from-slate-800/40 to-slate-900/60 backdrop-blur-xl border border-slate-700/30 rounded-3xl p-8 shadow-2xl">
                <div className="text-center space-y-6">
                  {/* Loading spinner */}
                  <div className="mx-auto w-16 h-16 relative">
                    <div className="absolute inset-0 rounded-full border-4 border-slate-600"></div>
                    <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-light-cool animate-spin"></div>
                  </div>

                  <h2 className="text-2xl font-GoodTimes text-white">
                    Initializing Space
                  </h2>

                  <p className="text-slate-300 text-lg">
                    Preparing your space experience…
                  </p>

                  {/* Progress dots */}
                  <div className="flex justify-center space-x-2">
                    <div className="w-2 h-2 bg-light-cool rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-light-cool rounded-full animate-pulse delay-150"></div>
                    <div className="w-2 h-2 bg-light-cool rounded-full animate-pulse delay-300"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-darkest-cool via-dark-cool to-mid-cool relative overflow-hidden">
      {/* Background gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-dark-warm/10 via-transparent to-transparent" />

      {/* Ambient background elements */}
      <div className="absolute top-1/6 left-1/6 w-72 h-72 bg-light-cool/5 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/6 right-1/6 w-64 h-64 bg-moon-gold/5 rounded-full blur-3xl animate-pulse delay-1000" />
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-light-cool/5 to-moon-gold/5 rounded-full blur-3xl animate-pulse delay-500" />

      <Container>
        <div className="relative z-10 py-8">
          {/* Header with glassmorphism */}
          <div className="mb-6">
            <div className="bg-gradient-to-r from-slate-800/30 to-slate-700/40 backdrop-blur-md border border-slate-600/20 rounded-xl p-3 shadow-lg">
              <div className="flex flex-col md:flex-row items-center justify-between gap-3 md:gap-0">
                <div className="flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-light-cool to-moon-gold rounded-lg flex items-center justify-center flex-shrink-0">
                    <RocketLaunchIcon className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex flex-col md:flex-row items-center space-y-1 md:space-y-0 md:space-x-4 text-center md:text-left">
                    <h1 className="text-lg font-GoodTimes text-white whitespace-nowrap">
                      MoonDAO Space
                    </h1>
                    <span className="text-slate-300 text-sm whitespace-nowrap">
                      Welcome, {citizenName}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2 text-sm text-slate-400 flex-shrink-0">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="whitespace-nowrap">Connected</span>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced iframe container with glassmorphism */}
          <div
            ref={gameContainerRef}
            className={`bg-gradient-to-b from-slate-800/20 to-slate-900/30 backdrop-blur-md border border-slate-600/20 rounded-3xl p-3 shadow-2xl transition-all duration-300 relative ${
              isFullscreen ? 'fixed inset-0 z-50 bg-black rounded-none p-0' : ''
            }`}
            style={isFullscreen ? { height: '100dvh' } : undefined}
          >
            {/* Fullscreen button positioned in top right of game container */}
            {(() => {
              const shouldShow = true // Always show the button
              console.log('Fullscreen button visibility:', {
                isMobile,
                isFullscreen,
                shouldShow,
              })
              return shouldShow
            })() && (
              <button
                onClick={toggleFullscreen}
                className={`absolute z-10 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-600/40 rounded-lg transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-light-cool/50 backdrop-blur-sm ${
                  isFullscreen ? 'top-4 right-4' : 'top-5 right-5'
                } ${isMobile && isFullscreen ? 'p-3' : 'p-2'}`}
                title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              >
                {isFullscreen ? (
                  <ArrowsPointingInIcon
                    className={`text-slate-300 ${
                      isMobile && isFullscreen ? 'w-5 h-5' : 'w-4 h-4'
                    }`}
                  />
                ) : (
                  <ArrowsPointingOutIcon className="w-4 h-4 text-slate-300" />
                )}
              </button>
            )}
            <iframe
              src={iframeSrc}
              className={`w-full border-0 bg-black/10 transition-all duration-300 ${
                isFullscreen
                  ? `${isMobile ? 'h-[95dvh]' : 'h-screen'} rounded-none`
                  : 'h-[75vh] rounded-2xl'
              }`}
              style={isFullscreen ? { height: '100dvh' } : undefined}
              allow="microphone *; autoplay; camera; midi; encrypted-media;"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
              referrerPolicy="no-referrer-when-downgrade"
              title="MoonDAO Space"
            />
          </div>

          {/* Footer info */}
          <div className="mt-6">
            <div className="bg-gradient-to-r from-slate-800/20 to-slate-700/30 backdrop-blur-md border border-slate-600/20 rounded-xl p-4 shadow-lg">
              <div className="flex items-center justify-center space-x-6 text-sm text-slate-400">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-light-cool rounded-full" />
                  <span>Secure Connection</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-moon-gold rounded-full" />
                  <span>Citizen Verification</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span>Real-time Experience</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </div>
  )
}
