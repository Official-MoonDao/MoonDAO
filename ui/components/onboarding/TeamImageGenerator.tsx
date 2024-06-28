import html2canvas from 'html2canvas'
import Head from 'next/head'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { StageButton } from './StageButton'

export function ImageGenerator({ setImage, nextStage, stage }: any) {
  const [userImage, setUserImage] = useState<File>()

  async function submitImage() {
    if (!document.getElementById('entityPic'))
      return console.error('entityPic is not defined')
    // @ts-expect-error
    await html2canvas(document.getElementById('entityPic')).then((canvas) => {
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
      const file = new File([blob], 'entityPic.png', { type: mimeString })

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
        <StageButton className="" onClick={submitImage}>
          Submit Image
        </StageButton>
      </div>

      <div className="justify-center relative flex" id="entityPic">
        <Image
          src="/flat-moondao-flag.png"
          // layout="fill"
          width={600}
          height={600}
          objectFit="contain"
          alt="flag"
        />
        {userImage && (
          <div
          // style={{
          //   position: 'absolute',
          //   top: -50,
          //   left: 0,
          //   width: '100%',
          //   height: '100%',
          //   display: 'flex',
          //   justifyContent: 'center',
          //   alignItems: 'center',
          // }}
          // className="w-full h-full justify-center items-center mix-blend-multiply"
          >
            <Image
              className="z-30 absolute mix-blend-multiply max-w-[300px] max-h-[200px] md:max-w-[400px] md:max-h-[300px] w-auto h-auto top-[95px] left-[90px] md:top-[170px] md:left-[170px]"
              src={URL.createObjectURL(userImage)}
              alt="user image"
              width={200}
              height={200}
              objectFit="contain"
            />
          </div>
        )}
      </div>
    </div>
  )
}
