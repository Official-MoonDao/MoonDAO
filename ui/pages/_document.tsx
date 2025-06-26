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

          <meta name="theme-color" content="#54c3ff" />
          <link rel="icon" href="/favicon.ico" />

          <script
            dangerouslySetInnerHTML={{
              __html: `globalThis.Browser = { T: () => {} };`,
            }}
          />
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
