import html2canvas from 'html2canvas-pro'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import useImageGenerator from '@/lib/image-generator/useImageGenerator'
import FileInput from '../layout/FileInput'
import IPFSRenderer from '../layout/IPFSRenderer'

export function ImageGenerator({
  currImage,
  image,
  setImage,
  inputImage,
  setInputImage,
  nextStage,
  generateInBG,
}: any) {
  const {
    generateImage,
    isLoading: generating,
    error: generateError,
  } = useImageGenerator('/api/image-gen/citizen-image', inputImage, setImage)
  
  const [hasGeneratedImage, setHasGeneratedImage] = useState(false)
  const [showError, setShowError] = useState(false)

  // Clear error when new input image is uploaded
  useEffect(() => {
    if (inputImage) {
      setShowError(false)
    }
  }, [inputImage])

  // Show error when generateError occurs
  useEffect(() => {
    if (generateError) {
      setShowError(true)
    }
  }, [generateError])

  // Track when image has been generated
  useEffect(() => {
    if (image && !generating) {
      setHasGeneratedImage(true)
    }
  }, [image, generating])

  async function submitImage() {
    if (!document.getElementById('citizenPic'))
      return console.error('citizenPic is not defined')
    if (inputImage) {
      // @ts-expect-error
      await html2canvas(document.getElementById('citizenPic')).then(
        (canvas) => {
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
          const file = new File([blob], 'citizenPic.png', { type: mimeString })

          setImage(file)
        }
      )
    }
    nextStage()
  }

  return (
    <div className="animate-fadeIn flex flex-col">
      <div className="flex items-start flex-col mt-5">
        <FileInput
          file={inputImage}
          setFile={setInputImage}
          noBlankImages
          accept="image/png, image/jpeg, image/webp, image/gif, image/svg"
          acceptText="Accepted file types: PNG, JPEG, WEBP, GIF, SVG"
        />
      </div>
      <div
        id="citizenPic"
        className="mt-4 w-[90vw] rounded-[5vmax] rounded-tl-[20px] h-[90vw] md:w-[430px] md:h-[430px] lg:w-[600px] lg:h-[600px] bg-cover justify-left relative flex"
      >
        {currImage && !inputImage && (
          <IPFSRenderer
            src={currImage}
            className=""
            width={600}
            height={600}
            alt="Citizen Image"
          />
        )}
        {inputImage && (
          <>
            {image ? (
              <Image
                src={URL.createObjectURL(image)}
                layout="fill"
                objectFit="contain"
                className=""
                alt={''}
              />
            ) : generating ? (
              <Image
                src={'/assets/MoonDAO-Loading-Animation.svg'}
                layout="fill"
                objectFit="contain"
                className=""
                alt={''}
              />
            ) : (
              <Image
                src={URL.createObjectURL(inputImage)}
                layout="fill"
                objectFit="contain"
                className=""
                alt={''}
              />
            )}
          </>
        )}
      </div>
      {showError && generateError && (
        <p className="mt-2 ml-2 opacity-[50%]">{generateError}</p>
      )}
      {inputImage && (
        <button
          className="mt-6 w-auto px-8 py-2 gradient-2 hover:scale-105 transition-transform rounded-xl font-medium text-base"
          onClick={() => {
            setImage(null)
            setHasGeneratedImage(false)
            setShowError(false)
            generateImage()
          }}
        >
          {generating ? 'loading...' : hasGeneratedImage ? 'Regenerate Image' : 'Generate Image'}
        </button>
      )}
      {(currImage && !inputImage) || image ? (
        <button
          className="mt-6 w-auto px-8 py-2 gradient-2 hover:scale-105 transition-transform rounded-xl font-medium text-base"
          onClick={submitImage}
        >
          Next
        </button>
      ) : (
        <></>
      )}
    </div>
  )
}
