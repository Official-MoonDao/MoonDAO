import { XMarkIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    // Check if already installed
    const isInStandaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true

    setIsStandalone(isInStandaloneMode)
    console.log('[PWA] Standalone mode:', isInStandaloneMode)

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    setIsIOS(iOS)
    console.log('[PWA] iOS detected:', iOS)

    // Check if desktop
    const desktop =
      !iOS && !/Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    setIsDesktop(desktop)
    console.log('[PWA] Desktop detected:', desktop)

    // Check if user has already dismissed the prompt
    const dismissed = localStorage.getItem('pwa-install-dismissed')
    if (dismissed) {
      const dismissedDate = new Date(dismissed)
      const now = new Date()
      const daysSinceDismissed = (now.getTime() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24)

      console.log('[PWA] Days since dismissed:', daysSinceDismissed)
      // Show again after 30 days
      if (daysSinceDismissed < 30) {
        console.log('[PWA] Install prompt dismissed recently, not showing')
        return
      }
    }

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('[PWA] beforeinstallprompt event fired!')
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShowPrompt(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    console.log('[PWA] Listening for beforeinstallprompt event')

    // For iOS, show prompt if not already installed
    if (iOS && !isInStandaloneMode && !dismissed) {
      console.log('[PWA] Showing iOS install instructions')
      setShowPrompt(true)
    }

    // Debug: Check service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        console.log('[PWA] Service worker registrations:', registrations.length)
      })
    } else {
      console.log('[PWA] Service worker not supported')
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice

      if (outcome === 'accepted') {
        setDeferredPrompt(null)
        setShowPrompt(false)
      }
    }
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem('pwa-install-dismissed', new Date().toISOString())
  }

  // Don't show if already installed or shouldn't show
  if (isStandalone || !showPrompt) {
    return null
  }

  return (
    <div
      className={`fixed z-[9998] animate-slide-up ${
        isDesktop
          ? 'bottom-6 right-6 max-w-sm'
          : 'bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md'
      }`}
    >
      <div className="bg-gradient-to-br from-gray-900/98 via-blue-900/95 to-purple-900/90 backdrop-blur-xl border border-white/30 rounded-xl shadow-2xl p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
              <img src="/icons/icon-72x72.png" alt="MoonDAO Icon" className="w-10 h-10" />
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
            className="text-gray-400 hover:text-white transition-colors p-1 flex-shrink-0"
            aria-label="Dismiss"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {isIOS ? (
          <div className="space-y-2 text-sm text-gray-300">
            <p className="font-medium text-white">To install on iOS:</p>
            <ol className="list-decimal list-inside space-y-1 text-xs">
              <li>Tap the Share button (square with arrow)</li>
              <li>Scroll down and tap "Add to Home Screen"</li>
              <li>Tap "Add" in the top right corner</li>
            </ol>
          </div>
        ) : (
          <div className="space-y-2">
            <button
              onClick={handleInstallClick}
              className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-medium py-2.5 px-4 rounded-lg transition-all duration-200 transform hover:scale-105"
            >
              <ArrowDownTrayIcon className="w-5 h-5" />
              <span>Install App</span>
            </button>
            {isDesktop && (
              <p className="text-xs text-gray-400 text-center">
                Works on Chrome, Edge, Brave and other Chromium browsers
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
