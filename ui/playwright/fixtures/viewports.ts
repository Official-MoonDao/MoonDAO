/**
 * Viewport configurations for responsive testing
 * Used by the bug detection agent to test across different screen sizes
 */

export interface ViewportConfig {
  name: string
  width: number
  height: number
  deviceScaleFactor?: number
  isMobile?: boolean
  hasTouch?: boolean
}

export const VIEWPORTS: Record<string, ViewportConfig> = {
  // Desktop viewports
  desktop4k: {
    name: 'Desktop 4K',
    width: 3840,
    height: 2160,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
  desktopLarge: {
    name: 'Desktop Large',
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
  desktopMedium: {
    name: 'Desktop Medium',
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
  desktopSmall: {
    name: 'Desktop Small',
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },

  // Tablet viewports
  tabletLandscape: {
    name: 'Tablet Landscape',
    width: 1024,
    height: 768,
    deviceScaleFactor: 2,
    isMobile: false,
    hasTouch: true,
  },
  tabletPortrait: {
    name: 'Tablet Portrait',
    width: 768,
    height: 1024,
    deviceScaleFactor: 2,
    isMobile: false,
    hasTouch: true,
  },
  iPadPro: {
    name: 'iPad Pro',
    width: 1366,
    height: 1024,
    deviceScaleFactor: 2,
    isMobile: false,
    hasTouch: true,
  },

  // Mobile viewports
  mobileIPhonePro: {
    name: 'iPhone 14 Pro',
    width: 393,
    height: 852,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
  mobileIPhoneSE: {
    name: 'iPhone SE',
    width: 375,
    height: 667,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  mobileAndroid: {
    name: 'Android (Pixel 5)',
    width: 393,
    height: 851,
    deviceScaleFactor: 2.75,
    isMobile: true,
    hasTouch: true,
  },
  mobileAndroidSmall: {
    name: 'Android Small',
    width: 360,
    height: 640,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
}

export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const

/**
 * Get all viewports for a specific category
 */
export function getViewportsByCategory(category: 'desktop' | 'tablet' | 'mobile'): ViewportConfig[] {
  const prefix = category === 'mobile' ? 'mobile' : category === 'tablet' ? 'tablet' : 'desktop'
  return Object.entries(VIEWPORTS)
    .filter(([key]) => key.toLowerCase().startsWith(prefix) || key.toLowerCase().includes(prefix))
    .map(([, config]) => config)
}

/**
 * Get viewports that should be tested at specific Tailwind breakpoints
 */
export function getBreakpointTestViewports(): ViewportConfig[] {
  return [
    VIEWPORTS.mobileAndroid,      // Below sm
    VIEWPORTS.tabletPortrait,     // md breakpoint
    VIEWPORTS.tabletLandscape,    // lg breakpoint
    VIEWPORTS.desktopSmall,       // xl breakpoint
    VIEWPORTS.desktopLarge,       // 2xl breakpoint
  ]
}
