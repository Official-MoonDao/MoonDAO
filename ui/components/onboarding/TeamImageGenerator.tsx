// Team Image Generator
import html2canvas from 'html2canvas-pro'
import { useState } from 'react'
import { MediaRenderer } from 'thirdweb/react'
import client from '@/lib/thirdweb/client'
import FileInput from '../layout/FileInput'
import { StageButton } from './StageButton'

export function ImageGenerator({ currImage, setImage, nextStage, stage }: any) {
  const [inputImage, setInputImage] = useState<File>()

  async function submitImage() {
    if (!document.getElementById('teamPic'))
      return console.error('teamPic is not defined')

    if (inputImage) {
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
      })
    }
    nextStage()
  }

  return (
    <div className="animate-fadeIn flex flex-col">
      <div className="flex items-start flex-col">
        <FileInput file={inputImage} setFile={setInputImage} noBlankImages />
      </div>

      {/* Show current team  image if no user image has been uploaded */}
      <div className="mt-4">
        {currImage && !inputImage && (
          <div
            id="teamPic"
            className="w-[90vw] h-[90vw] md:w-[600px] md:h-[600px] justify-left relative flex"
          >
            <MediaRenderer
              client={client}
              className="p-0 m-0"
              src={currImage}
              width="100%"
              height="100%"
            />
          </div>
        )}

        {/* Show uploaded image if available */}
        {inputImage && (
          <div
            id="teamPic"
            className="w-[90vw] h-[90vw] md:w-[600px] md:h-[600px] bg-[url('/moondao-team-flag.png')] bg-cover justify-left relative flex"
          >
            <div
              id="user-image"
              style={{
                backgroundImage: `url(${URL.createObjectURL(inputImage)})`,
              }}
              className="h-[48%] w-[75%] mt-[29%] ml-[15%] bg-contain bg-no-repeat bg-center mix-blend-multiply"
            ></div>
          </div>
        )}

        {/* Show placeholder if no current image and no uploaded image */}
        {!inputImage && !currImage && (
          <div
            id="teamPic"
            className="w-[90vw] h-[90vw] md:w-[600px] md:h-[600px] bg-[url('/moondao-team-flag.png')] bg-cover justify-left relative flex"
          >
            <div
              id="user-image"
              style={{
                backgroundImage: `url('/assets/image-placeholder.svg')`,
              }}
              className="h-[48%] w-[75%] mt-[29%] ml-[15%] bg-contain bg-no-repeat bg-center mix-blend-multiply"
            ></div>
          </div>
        )}
      </div>
      {currImage || inputImage ? (
        <StageButton className="" onClick={submitImage}>
          Next
        </StageButton>
      ) : (
        <></>
      )}
    </div>
  )
}
