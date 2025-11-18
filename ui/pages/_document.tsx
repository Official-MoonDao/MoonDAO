import Document, { Html, Head, Main, NextScript } from 'next/document'
import React from 'react'

class WebsiteDocument extends Document {
  render() {
    return (
      <Html>
        <Head>
          {/* Preload critical fonts to prevent FOUT */}
          <link
            rel="preload"
            href="/fonts/Lato-Regular.ttf"
            as="font"
            type="font/ttf"
            crossOrigin="anonymous"
          />
          <link
            rel="preload"
            href="/fonts/goodtimesrg.otf"
            as="font"
            type="font/otf"
            crossOrigin="anonymous"
          />

          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" />

          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap"
          />

          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Poppins:wght@200;300;400;500&display=swap"
          />

          {/* PWA Configuration */}
          <link rel="manifest" href="/manifest.json" />
          <meta name="theme-color" content="#1e3a8a" />

          {/* Favicon */}
          <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
          <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
          <link rel="shortcut icon" href="/favicon.ico" />

          {/* Apple Touch Icon */}
          <link rel="apple-touch-icon" href="/icons/apple/apple-touch-icon.png" />

          {/* iOS PWA Meta Tags */}
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
          <meta name="apple-mobile-web-app-title" content="MoonDAO" />

          {/* iOS Splash Screens */}
          {/* iPhone X, XS, 11 Pro, 12 mini, 13 mini */}
          <link
            rel="apple-touch-startup-image"
            href="/icons/apple/splash-1125x2436.png"
            media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
          />
          {/* iPhone XS Max, 11 Pro Max */}
          <link
            rel="apple-touch-startup-image"
            href="/icons/apple/splash-1242x2688.png"
            media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
          />
          {/* iPhone XR, 11 */}
          <link
            rel="apple-touch-startup-image"
            href="/icons/apple/splash-828x1792.png"
            media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
          />
          {/* iPhone 12, 12 Pro, 13, 13 Pro, 14 */}
          <link
            rel="apple-touch-startup-image"
            href="/icons/apple/splash-1170x2532.png"
            media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
          />
          {/* iPhone 12 Pro Max, 13 Pro Max, 14 Plus */}
          <link
            rel="apple-touch-startup-image"
            href="/icons/apple/splash-1284x2778.png"
            media="(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
          />
          {/* iPhone 14 Pro, 15, 15 Pro */}
          <link
            rel="apple-touch-startup-image"
            href="/icons/apple/splash-1179x2556.png"
            media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
          />
          {/* iPhone 14 Pro Max, 15 Plus, 15 Pro Max */}
          <link
            rel="apple-touch-startup-image"
            href="/icons/apple/splash-1290x2796.png"
            media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
          />
          {/* iPhone 8, SE */}
          <link
            rel="apple-touch-startup-image"
            href="/icons/apple/splash-750x1334.png"
            media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
          />
          {/* iPhone 8 Plus */}
          <link
            rel="apple-touch-startup-image"
            href="/icons/apple/splash-1242x2208.png"
            media="(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
          />
          {/* iPad Mini, Air */}
          <link
            rel="apple-touch-startup-image"
            href="/icons/apple/splash-1536x2048.png"
            media="(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
          />
          {/* iPad Pro 12.9" */}
          <link
            rel="apple-touch-startup-image"
            href="/icons/apple/splash-2048x2732.png"
            media="(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
          />
          {/* Fallback for other devices */}
          <link rel="apple-touch-startup-image" href="/icons/apple/splash-1170x2532.png" />

          {/* MS Tile Configuration */}
          <meta name="msapplication-TileColor" content="#1e3a8a" />
          <meta name="msapplication-TileImage" content="/icons/icon-144x144.png" />

          <script
            dangerouslySetInnerHTML={{
              __html: `globalThis.Browser = { T: () => {} };`,
            }}
          />

          {/* Vimeo Player SDK */}
          <script async src="https://player.vimeo.com/api/player.js"></script>
        </Head>
        <body className="overflow-hidden relative">
          <div className="w-full gradient-9 max-h-[100vh] h-full fixed top-0 left-0"></div>
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}

export default WebsiteDocument
