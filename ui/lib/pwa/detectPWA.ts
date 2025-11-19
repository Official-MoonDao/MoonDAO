export function isPWAMode(): boolean {
  if (typeof window === 'undefined') return false

  const standaloneMedia = window.matchMedia('(display-mode: standalone)').matches
  const minimalUIMedia = window.matchMedia('(display-mode: minimal-ui)').matches
  const fullscreenMedia = window.matchMedia('(display-mode: fullscreen)').matches
  const windowControlsMedia = window.matchMedia('(display-mode: window-controls-overlay)').matches
  const standaloneNavigator = (window.navigator as any).standalone === true
  const hasSourcePWA = window.location.search.includes('source=pwa')

  return (
    hasSourcePWA ||
    standaloneMedia ||
    minimalUIMedia ||
    fullscreenMedia ||
    windowControlsMedia ||
    standaloneNavigator
  )
}

export function hasAcceptedInstall(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('pwa-install-accepted') !== null
}
