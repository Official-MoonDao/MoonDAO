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
            Next injects body{display:none} (data-next-hide-fouc) until styles
            are ready + React hydrates, then removes it — this is what prevents a
            flash of unstyled (raw) HTML, especially in `next dev` where global
            CSS is injected by JS rather than a <link>. Do NOT reveal early: it
            shows raw HTML for seconds until Tailwind loads. Keep only a delayed
            safety net so a genuinely stalled hydration can't leave the page
            blank forever.
          */}
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){function r(){try{var l=document.querySelectorAll('style[data-next-hide-fouc]');for(var i=0;i<l.length;i++){var s=l[i];if(s&&s.parentNode)s.parentNode.removeChild(s);}if(document.body)document.body.style.display='';}catch(e){}}setTimeout(r,8000);})();`,
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
