import html2canvas from 'html2canvas'
import Head from 'next/head'
import Image from 'next/image'
import Script from 'next/script'
import { useEffect, useRef, useState } from 'react'
import { StageButton } from './StageButton'

export function ImageGenerator({ setImage, nextStage, stage }: any) {
  const pfpRef = useRef<any>()

  const [userImage, setUserImage] = useState<File>()

  async function submitImage() {
    if (!document.getElementById('pfp'))
      return console.error('pfpRef is not defined')
    // @ts-expect-error
    await html2canvas(document.getElementById('pfp')).then((canvas) => {
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

  useEffect(() => {
    fetch('/image-generator/init.js')
      .then((response) => response.text())
      .then((script) => {
        const runScript = new Function(script)
        runScript()

        //bug causes multiple param forms to be rendered, remove all except the first one
        const forms = document.querySelectorAll('.ctrl')
        for (let i = 1; i < forms.length; i++) {
          forms[i].remove()
        }
      })
  }, [])

  return (
    <div className="animate-fadeIn">
      <Head>
        <link href="/image-generator/celestial.css" rel="stylesheet" />
        <link href="/image-generator/pfp-style.css" rel="stylesheet" />
      </Head>

      <Script strategy="afterInteractive" src="/image-generator/init.js" />

      <div className="mb-12 flex items-start md:items-center flex-col gap-4 md:flex-row">
        <input
          className="text-moon-orange"
          type="file"
          accept="image/*"
          onChange={(e: any) => setUserImage(e.target.files[0])}
        />
        <StageButton className="" onClick={submitImage}>
          Submit Image
        </StageButton>
      </div>

      <div id="html-container">
        <div id="pfp" ref={pfpRef}>
          <div id="celestial-map"></div>
          <div id="canvas-container"></div>
          <img alt="default-img" id="process-image" src="" />
          {userImage && (
            <Image
              className="absolute w-full h-full"
              src={URL.createObjectURL(userImage as any)}
              width={500}
              height={500}
              alt=""
            />
          )}
        </div>
      </div>
    </div>
  )
}
