// Team Image Generator
import html2canvas from 'html2canvas-pro'
import Image from 'next/image'
import { useState } from 'react'
import FileInput from '../layout/FileInput'
import IPFSRenderer from '../layout/IPFSRenderer'
import { StageButton } from './StageButton'

export function ImageGenerator({ currImage, setImage, nextStage, stage }: any) {
  const [inputImage, setInputImage] = useState<File>()

  async function submitImage() {
    if (!document.getElementById('teamPic'))
      return console.error('teamPic is not defined')

    if (inputImage) {        // @ts-expect-error
        await html2canvas(document.getElementById('teamPic'), {
          width: 400,
          height: 400,
          scale: 1
        }).then((canvas) => {
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
    <div className="animate-fadeIn flex flex-col gap-6">
      <div className="flex items-start flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h4 className="font-medium text-white">Upload Team Image</h4>
          <p className="text-slate-300 text-sm">Choose an image to represent your team</p>
        </div>
        <FileInput
          file={inputImage}
          setFile={setInputImage}
          noBlankImages
          accept="image/png, image/jpeg, image/webp, image/gif, image/svg"
          acceptText="Accepted file types: PNG, JPEG, WEBP, GIF, SVG"
        />
      </div>

      {/* Show current team  image if no user image has been uploaded */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h4 className="font-medium text-white">Preview</h4>
          <p className="text-slate-300 text-sm">This is how your team image will appear</p>
        </div>
        <div className="bg-gradient-to-b from-slate-700/20 to-slate-800/30 rounded-xl border border-slate-600/30 p-4">
          {currImage && !inputImage && (
            <div
              id="teamPic"
              className="w-[70vw] h-[70vw] md:w-[400px] md:h-[400px] justify-left relative flex rounded-lg overflow-hidden"
            >
              <IPFSRenderer
                className="p-0 m-0 rounded-lg"
                src={currImage}
                width={400}
                height={400}
                alt="Team Image"
              />
            </div>
          )}

          {/* Show uploaded image if available */}
          {inputImage && (
            <div
              id="teamPic"
              className="w-[70vw] h-[70vw] md:w-[400px] md:h-[400px] bg-[url('/moondao-team-flag.png')] bg-cover justify-left relative flex rounded-lg overflow-hidden"
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
              className="w-[70vw] h-[70vw] md:w-[400px] md:h-[400px] bg-[url('/moondao-team-flag.png')] bg-cover justify-left relative flex rounded-lg overflow-hidden"
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
      </div>
      {currImage || inputImage ? (
        <button
          className="w-full gradient-2 hover:scale-105 transition-transform rounded-2xl py-3 font-medium text-white"
          onClick={submitImage}
        >
          Continue with this image
        </button>
      ) : (
        <></>
      )}
    </div>
  )
}
