import html2canvas from 'html2canvas'
import Head from 'next/head'
import Script from 'next/script'
import { useRef } from 'react'

export function ImageGenerator({ setImage, nextStage }: any) {
  const pfpRef = useRef<HTMLDivElement>()

  function submitImage() {
    if (!pfpRef?.current) return console.error('pfpRef is not defined')
    html2canvas(pfpRef?.current).then((canvas) => {
      const img = canvas.toDataURL('image/png')

      //Convert from base64 to file
      const byteString = atob(img.split(',')[1])
      const mimeString = img.split(',')[0].split(':')[1].split(';')[0]
      const ab = new ArrayBuffer(byteString.length)
      const ia = new Uint8Array(ab)
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i)
      }
      const blob = new Blob([ab], { type: mimeString })
      const file = new File([blob], 'pfp.png', { type: mimeString })

      setImage(file)

      nextStage()
    })
  }

  return (
    <>
      <Head>
        <link href="/image-generator/celestial.css" rel="stylesheet" />
        <link href="/image-generator/pfp-style.css" rel="stylesheet" />
      </Head>

      <Script src="/image-generator/init.js" />
      <button onClick={submitImage}>Download</button>
      <div id="html-container">
        <div id="pfp" ref={pfpRef}>
          <div id="celestial-map"></div>
          <div id="canvas-container"></div>
          <img
            alt="default-img"
            id="process-image"
            src="/image-generator/images/test-00.jpg"
          />
        </div>
      </div>
    </>
  )
}
