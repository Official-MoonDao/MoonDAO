import { XMarkIcon, ArrowDownTrayIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { isPWAMode, hasAcceptedInstall } from '@/lib/pwa/detectPWA'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type BrowserType =
  | 'chrome'
  | 'edge'
  | 'firefox'
  | 'safari'
  | 'safari-ios'
  | 'samsung'
  | 'opera'
  | 'brave'
  | 'unknown'

interface BrowserInfo {
  type: BrowserType
  name: string
  supportsInstall: boolean
  supportsNativePrompt: boolean
}

function detectBrowser(): BrowserInfo {
  const ua = navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream

  // Safari iOS
  if (isIOS) {
    return {
      type: 'safari-ios',
      name: 'Safari (iOS)',
      supportsInstall: true,
      supportsNativePrompt: false,
    }
  }

  // Samsung Internet
  if (ua.indexOf('SamsungBrowser') > -1) {
    return {
      type: 'samsung',
      name: 'Samsung Internet',
      supportsInstall: true,
      supportsNativePrompt: true,
    }
  }

  // Opera
  if (ua.indexOf('OPR') > -1 || ua.indexOf('Opera') > -1) {
    return {
      type: 'opera',
      name: 'Opera',
      supportsInstall: true,
      supportsNativePrompt: true,
    }
  }

  // Edge (Chromium-based)
  if (ua.indexOf('Edg') > -1) {
    return {
      type: 'edge',
      name: 'Microsoft Edge',
      supportsInstall: true,
      supportsNativePrompt: true,
    }
  }

  // Brave
  if ((navigator as any).brave && typeof (navigator as any).brave.isBrave === 'function') {
    return {
      type: 'brave',
      name: 'Brave',
      supportsInstall: true,
      supportsNativePrompt: true,
    }
  }

  // Chrome
  if (ua.indexOf('Chrome') > -1 && ua.indexOf('Edg') === -1) {
    return {
      type: 'chrome',
      name: 'Google Chrome',
      supportsInstall: true,
      supportsNativePrompt: true,
    }
  }

  // Firefox
  if (ua.indexOf('Firefox') > -1) {
    return {
      type: 'firefox',
      name: 'Firefox',
      supportsInstall: true,
      supportsNativePrompt: false,
    }
  }

  // Safari (Desktop)
  if (ua.indexOf('Safari') > -1 && ua.indexOf('Chrome') === -1) {
    return {
      type: 'safari',
      name: 'Safari',
      supportsInstall: false,
      supportsNativePrompt: false,
    }
  }

  return {
    type: 'unknown',
    name: 'Unknown Browser',
    supportsInstall: false,
    supportsNativePrompt: false,
  }
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)
  const [browserInfo, setBrowserInfo] = useState<BrowserInfo | null>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const [cookieBannerVisible, setCookieBannerVisible] = useState(true)
  const [isInitialized, setIsInitialized] = useState(false)

  // Initial setup, runs once on mount
  useEffect(() => {
    // Check if user has already accepted/installed
    if (hasAcceptedInstall()) {
      setIsInitialized(true)
      return
    }

    // Check if cookie banner is visible
    const cookieConsent = localStorage.getItem('cookie_consent')
    const isCookieBannerShowing = cookieConsent === null || cookieConsent === undefined
    setCookieBannerVisible(isCookieBannerShowing)

    // Detect browser
    const browser = detectBrowser()
    setBrowserInfo(browser)

    // Check if already installed using shared utility
    const isInStandaloneMode = isPWAMode()
    setIsStandalone(isInStandaloneMode)

    // Check if iOS
    const iOS = browser.type === 'safari-ios'
    setIsIOS(iOS)

    // Check if desktop
    const desktop =
      !iOS && !/Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    setIsDesktop(desktop)

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // Listen for display mode changes (detects when PWA fully launches)
    const standaloneMediaQuery = window.matchMedia('(display-mode: standalone)')
    const handleDisplayModeChange = () => {
      const isNowStandalone = isPWAMode()

      if (isNowStandalone) {
        setIsStandalone(true)
        setIsInitialized(true)
      }
    }

    standaloneMediaQuery.addEventListener('change', handleDisplayModeChange)

    // Listen for cookie consent changes (works across tabs)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'cookie_consent' && e.newValue !== null) {
        setCookieBannerVisible(false)
      }
    }

    window.addEventListener('storage', handleStorageChange)

    // Delayed check to catch late-switching to standalone mode
    const delayedStandaloneCheck = setTimeout(() => {
      const isNowStandalone = isPWAMode()

      if (isNowStandalone && !isInStandaloneMode) {
        setIsStandalone(true)
      }

      setIsInitialized(true)
    }, 600)

    // Poll for cookie consent changes in the same tab (only if cookie banner is showing)
    let checkInterval: NodeJS.Timeout | null = null
    if (isCookieBannerShowing) {
      checkInterval = setInterval(() => {
        const cookieConsent = localStorage.getItem('cookie_consent')
        if (cookieConsent !== null && cookieConsent !== undefined) {
          setCookieBannerVisible(false)
          if (checkInterval) clearInterval(checkInterval)
        }
      }, 500)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      standaloneMediaQuery.removeEventListener('change', handleDisplayModeChange)
      window.removeEventListener('storage', handleStorageChange)
      clearTimeout(delayedStandaloneCheck)
      if (checkInterval) clearInterval(checkInterval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Separate effect to decide whether to show the prompt
  useEffect(() => {
    if (!isInitialized) {
      return
    }

    // Don't show if cookie banner is visible or already running as PWA
    if (cookieBannerVisible || isStandalone) {
      if (showPrompt && isStandalone) {
        setShowPrompt(false)
      }
      return
    }

    // Check if user has already accepted/installed
    const accepted = localStorage.getItem('pwa-install-accepted')
    if (accepted) {
      return
    }

    // Check if user has already dismissed the prompt
    const dismissed = localStorage.getItem('pwa-install-dismissed')
    if (dismissed) {
      const dismissedDate = new Date(dismissed)
      const now = new Date()
      const daysSinceDismissed = (now.getTime() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24)

      if (daysSinceDismissed < 30) {
        return
      }
    }

    // For iOS, show prompt
    if (isIOS) {
      setTimeout(() => setShowPrompt(true), 500)
      return
    }

    // For desktop, check service worker and show prompt
    if (isDesktop && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        if (registrations.length > 0) {
          setTimeout(() => setShowPrompt(true), 500)
        }
      })
    } else if (!isDesktop) {
      // For mobile (non-iOS), show if service worker is available
      setTimeout(() => setShowPrompt(true), 500)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, cookieBannerVisible, isStandalone, isIOS, isDesktop, deferredPrompt])

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice

        if (outcome === 'accepted') {
          localStorage.setItem('pwa-install-accepted', new Date().toISOString())
          setDeferredPrompt(null)
          setShowPrompt(false)
        }
      } catch (error) {
        console.error('[PWA] Install prompt error:', error)
        setShowInstructions(true)
      }
    } else {
      setShowInstructions(true)
    }
  }

  const getBrowserInstructions = (): { steps: string[]; note?: string } => {
    if (!browserInfo) return { steps: ['Browser not detected'] }

    switch (browserInfo.type) {
      case 'chrome':
        return {
          steps: [
            'Look for the install icon (⊕ or 💻) in the address bar (right side)',
            'Click the install icon',
            'Click "Install" in the popup',
          ],
          note: 'Alternative: Click menu (⋮) > "Install MoonDAO"',
        }

      case 'edge':
        return {
          steps: [
            'Look for the install icon (⊕ or app icon) in the address bar (right side)',
            'Click the install icon',
            'Click "Install" in the popup',
          ],
          note: 'Alternative: Click menu (⋯) > "Apps" > "Install MoonDAO"',
        }

      case 'brave':
        return {
          steps: [
            'Look for the install icon (⊕ or app icon) in the address bar (right side)',
            'Click the install icon',
            'Click "Install" in the popup',
          ],
          note: 'Alternative: Click menu (☰) > "Install MoonDAO"',
        }

      case 'firefox':
        return {
          steps: [
            'Click the menu icon (☰) in the top-right corner',
            'Select "Install MoonDAO"',
            'Click "Install" in the popup',
          ],
          note: 'PWA support in Firefox may vary by platform',
        }

      case 'samsung':
        return {
          steps: [
            'Tap the menu icon (☰) at the bottom',
            'Tap "Add page to" > "Home screen"',
            'Tap "Add"',
          ],
        }

      case 'opera':
        return {
          steps: [
            'Click the menu icon in the top-left corner',
            'Select "Install MoonDAO"',
            'Click "Install" in the popup',
          ],
        }

      case 'safari-ios':
        return {
          steps: [
            'Tap the Share button (square with arrow up) at the bottom',
            'Scroll down and tap "Add to Home Screen"',
            'Tap "Add" in the top-right corner',
          ],
        }

      case 'safari':
        return {
          steps: ['Safari on macOS does not support PWA installation'],
          note: 'Please use Chrome, Edge, or another Chromium-based browser',
        }

      default:
        return {
          steps: [
            "Look for an install icon in your browser's address bar",
            'Or check your browser\'s menu for "Install" or "Add to Home Screen" options',
          ],
          note: 'Installation steps vary by browser. Try Chrome, Edge, or Firefox for the best experience.',
        }
    }
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem('pwa-install-dismissed', new Date().toISOString())
  }

  // SYNCHRONOUS check at render time - don't rely only on state
  const isCurrentlyStandalone =
    typeof window !== 'undefined' && (isPWAMode() || hasAcceptedInstall())

  // Don't show if already installed, cookie banner visible, or shouldn't show
  if (isCurrentlyStandalone || isStandalone || !showPrompt || cookieBannerVisible) {
    return null
  }

  const instructions = getBrowserInstructions()

  return (
    <>
      {/* Install Prompt Card - Matches Cookie Banner Style */}
      <div className="mx-auto max-w-max md:max-w-screen-sm fixed -bottom-0 md:bottom-8 left-0 right-0 px-4 md:px-6 py-4 flex-col bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl text-white z-[998] animate-slide-up">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
              <Image
                src="/icons/icon-72x72.png"
                alt="MoonDAO Icon"
                width={32}
                height={32}
                className="w-8 h-8"
              />
            </div>
            <div className="flex-1">
              <h3 className="text-white font-semibold text-sm">
                Install MoonDAO {isDesktop && 'App'}
              </h3>
              <p className="text-gray-300 text-xs">
                {isDesktop
                  ? 'Install for faster access and offline support'
                  : 'Add to your home screen for quick access'}
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-white transition-colors p-1 flex-shrink-0 ml-2"
            aria-label="Dismiss"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {isIOS ? (
          <div className="space-y-2">
            <div className="text-sm text-gray-300">
              <p className="font-medium text-white mb-2">To install on iOS:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                {instructions.steps.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
            </div>
            <div className="flex gap-3 items-center justify-center pt-2">
              <button
                className="px-5 py-2 rounded-lg bg-black/20 border border-white/10 text-white hover:bg-black/30 hover:border-white/20 transition-all duration-200 font-medium text-sm"
                onClick={handleDismiss}
              >
                Maybe Later
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-3 items-center justify-center pt-2">
            <button
              className="px-5 py-2 rounded-lg bg-black/20 border border-white/10 text-white hover:bg-black/30 hover:border-white/20 transition-all duration-200 font-medium text-sm"
              onClick={handleDismiss}
            >
              Not Now
            </button>
            <button
              onClick={handleInstallClick}
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium transition-all duration-200 transform hover:scale-105 shadow-lg text-sm flex items-center gap-2"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              <span>{deferredPrompt ? 'Install App' : 'How to Install'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Instructions Modal */}
      {showInstructions && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-gradient-to-br from-gray-900 via-blue-900/90 to-purple-900/80 border border-white/30 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-in">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <QuestionMarkCircleIcon className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-lg">How to Install</h3>
                  {browserInfo && <p className="text-gray-300 text-sm">For {browserInfo.name}</p>}
                </div>
              </div>
              <button
                onClick={() => setShowInstructions(false)}
                className="text-gray-400 hover:text-white transition-colors p-1"
                aria-label="Close"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <ol className="list-decimal list-inside space-y-2 text-gray-200">
                {instructions.steps.map((step, index) => (
                  <li key={index} className="text-sm leading-relaxed pl-2">
                    {step}
                  </li>
                ))}
              </ol>

              {instructions.note && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                  <p className="text-blue-200 text-xs leading-relaxed">{instructions.note}</p>
                </div>
              )}

              {browserInfo && !browserInfo.supportsInstall && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                  <p className="text-yellow-200 text-xs leading-relaxed">
                    Your browser may not fully support PWA installation. For the best experience,
                    try Chrome, Edge, or Firefox.
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowInstructions(false)}
              className="mt-6 w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-medium py-2.5 px-4 rounded-lg transition-all duration-200 transform hover:scale-105"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  )
}
