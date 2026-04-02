// Team Image Generator
import html2canvas from 'html2canvas-pro'
import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import FileInput from '../layout/FileInput'
import IPFSRenderer from '../layout/IPFSRenderer'

export function ImageGenerator({ currImage, setImage, nextStage, stage }: any) {
  const [inputImage, setInputImage] = useState<File>()

  const inputImageUrl = useMemo(
    () => (inputImage ? URL.createObjectURL(inputImage) : undefined),
    [inputImage]
  )

  useEffect(() => {
    return () => {
      if (inputImageUrl) URL.revokeObjectURL(inputImageUrl)
    }
  }, [inputImageUrl])

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
      {/* Upload zone + placeholder when no image selected */}
      {!inputImage && !currImage && (
        <div className="flex flex-col gap-4">
          <FileInput
            file={inputImage}
            setFile={setInputImage}
            noBlankImages
            accept="image/png, image/jpeg, image/webp, image/gif, image/svg"
            acceptText="PNG, JPEG, WEBP, GIF, SVG"
          />
          <div className="rounded-2xl border border-white/[0.08] bg-slate-900/40 overflow-hidden">
            <div
              id="teamPic"
              className="w-full aspect-square max-w-[400px] mx-auto bg-[url('/moondao-team-flag.png')] bg-cover relative flex overflow-hidden"
            >
              <div
                id="user-image"
                style={{
                  backgroundImage: `url('/assets/image-placeholder.svg')`,
                }}
                className="h-[48%] w-[75%] mt-[29%] ml-[15%] bg-contain bg-no-repeat bg-center mix-blend-multiply"
              />
            </div>
          </div>
        </div>
      )}

      {/* Preview when image is selected */}
      {(inputImage || currImage) && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">
              {inputImage ? 'Your team image preview' : 'Current team image'}
            </p>
            {inputImage && (
              <button
                onClick={() => setInputImage(undefined)}
                className="text-xs text-slate-500 hover:text-white transition-colors"
              >
                Change image
              </button>
            )}
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-slate-900/40 overflow-hidden">
            {currImage && !inputImage && (
              <div
                id="teamPic"
                className="w-full aspect-square max-w-[400px] mx-auto relative flex overflow-hidden"
              >
                <IPFSRenderer
                  className="p-0 m-0"
                  src={currImage}
                  width={400}
                  height={400}
                  alt="Team Image"
                />
              </div>
            )}

            {inputImage && (
              <div
                id="teamPic"
                className="w-full aspect-square max-w-[400px] mx-auto bg-[url('/moondao-team-flag.png')] bg-cover relative flex overflow-hidden"
              >
                <div
                  id="user-image"
                  style={{
                    backgroundImage: `url(${inputImageUrl})`,
                  }}
                  className="h-[48%] w-[75%] mt-[29%] ml-[15%] bg-contain bg-no-repeat bg-center mix-blend-multiply"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Continue */}
      {(currImage || inputImage) && (
        <button
          className="w-full py-3 gradient-2 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 rounded-2xl font-semibold text-white flex items-center justify-center gap-2"
          onClick={submitImage}
        >
          Continue
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </div>
  )
}
