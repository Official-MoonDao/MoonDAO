import html2canvas from 'html2canvas'
import Head from 'next/head'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { StageButton } from './StageButton'

export function ImageGenerator({ setImage, nextStage, stage }: any) {
  const [userImage, setUserImage] = useState<File>()

  async function submitImage() {
    if (!document.getElementById('teamPic'))
      return console.error('teamPic is not defined')
    // @ts-expect-error
    await html2canvas(document.getElementById('teamPic')).then((canvas) => {
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
      const file = new File([blob], 'teamPic.png', { type: mimeString })

      setImage(file)
      nextStage()
    })
  }

  return (
    <div className="animate-fadeIn flex flex-col">
      <div className="mb-12 flex items-start md:items-center flex-col gap-4 md:flex-row">
        <input
          className="text-moon-orange"
          type="file"
          accept="image/*"
          onChange={(e: any) => setUserImage(e.target.files[0])}
        />
        {userImage && (
          <StageButton className="" onClick={submitImage}>
            Save Design
          </StageButton>
        )}
      </div>
      <div
        id="teamPic"
        className="w-[90vw] h-[90vw] md:w-[600px] md:h-[600px] bg-[url('/flat-moondao-flag.png')] bg-cover justify-left relative flex"
        >
        {userImage && (
          <div
            id="user-image"
            style={{
              backgroundImage: `url(${URL.createObjectURL(userImage)})`,
            }}
            className="h-[48%] w-[75%] mt-[29%] ml-[15%] bg-contain bg-no-repeat bg-center mix-blend-multiply"
          ></div>
        )}
      </div>
    </div>
  )
}
