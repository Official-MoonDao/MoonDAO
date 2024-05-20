import Document, { Html, Head, Main, NextScript } from 'next/document'
import React from 'react'

class WebsiteDocument extends Document {
  render() {
    return (
      <Html>
        <Head>
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

          {/* Scripts for Image Generator */}
          <script defer src="/image-generator/hsluv.min.js"></script>
          <script defer src="/image-generator/d3.min.js"></script>
          <script defer src="/image-generator/d3.delaunay.js"></script>
          <script
            defer
            src="/image-generator/d3.geo.projection.min.js"
          ></script>
          <script defer src="/image-generator/p5js.min.js"></script>
          <script defer src="/image-generator/celestial.js"></script>
          <script defer src="/image-generator/weighted-voronoi.js"></script>
        </Head>
        <body className="overflow-hidden">
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}

export default WebsiteDocument
