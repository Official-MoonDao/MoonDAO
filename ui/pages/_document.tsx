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

          {/* Montserrat is loaded from Google Fonts via globals.css */}
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" />

          <meta name="theme-color" content="#54c3ff" />
          <link rel="icon" href="/favicon.ico" />

          <script
            dangerouslySetInnerHTML={{
              __html: `globalThis.Browser = { T: () => {} };`,
            }}
          />
          {/*
            Next injects body{display:none} (data-next-hide-fouc) until React
            hydrates. With large client bundles that can leave a blank page for
            a long time (or forever if hydration errors). Reveal SSR HTML ASAP.
          */}
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){function r(){try{var s=document.querySelector('style[data-next-hide-fouc]');if(s&&s.parentNode)s.parentNode.removeChild(s);if(document.body)document.body.style.display='block';}catch(e){}}r();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',r);setTimeout(r,0);})();`,
            }}
          />
        </Head>
        <body className="overflow-hidden relative">
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}

export default WebsiteDocument
