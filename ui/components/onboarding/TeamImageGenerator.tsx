// Team Image Generator
import { MediaRenderer } from '@thirdweb-dev/react'
import html2canvas from 'html2canvas'
import { useState } from 'react'
import { StageButton } from './StageButton'

export function ImageGenerator({ currImage, setImage, nextStage, stage }: any) {
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
      <div className="flex items-start flex-col">
        <input
          className="text-white text-opacity-80"
          type="file"
          accept="image/*"
          onChange={(e: any) => setUserImage(e.target.files[0])}
        />
        {currImage || userImage ? (
          <StageButton className="" onClick={submitImage}>
            Save Design
          </StageButton>
        ) : (
          <></>
        )}
      </div>

      {/* Show current team  image if no user image has been uploaded */}
      {currImage && !userImage && (
        <div
          id="teamPic"
          className="w-[90vw] h-[90vw] md:w-[600px] md:h-[600px] justify-left relative flex"
        >
          <MediaRenderer
            className="p-0 m-0"
            src={currImage}
            width="100%"
            height="100%"
          />
        </div>
      )}

      {/* Show uploaded image if available */}
      {userImage && (
        <div
          id="teamPic"
          className="w-[90vw] h-[90vw] md:w-[600px] md:h-[600px] bg-[url('/flat-moondao-flag.png')] bg-cover justify-left relative flex"
        >
          <div
            id="user-image"
            style={{
              backgroundImage: `url(${URL.createObjectURL(userImage)})`,
            }}
            className="h-[48%] w-[75%] mt-[29%] ml-[15%] bg-contain bg-no-repeat bg-center mix-blend-multiply"
          ></div>
        </div>
      )}

      {/* Show placeholder if no current image and no uploaded image */}
      {!userImage && !currImage && (
        <div
          id="teamPic"
          className="w-[90vw] h-[90vw] md:w-[600px] md:h-[600px] bg-[url('/flat-moondao-flag.png')] bg-cover justify-left relative flex"
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
  )
}
