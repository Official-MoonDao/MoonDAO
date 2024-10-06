import { MediaRenderer } from '@thirdweb-dev/react'
import html2canvas from 'html2canvas'
import Image from 'next/image'
import useImageGenerator from '@/lib/image-generator/useImageGenerator'
import FileInput from '../layout/FileInput'
import { StageButton } from './StageButton'

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
        <FileInput file={inputImage} setFile={setInputImage} />
      </div>
      <div
        id="citizenPic"
        className="mt-4 w-[90vw] rounded-[5vmax] rounded-tl-[20px] h-[90vw] md:w-[430px] md:h-[430px] lg:w-[600px] lg:h-[600px] bg-cover justify-left relative flex"
      >
        {currImage && !inputImage && (
          <MediaRenderer
            src={currImage}
            className=""
            width="100%"
            height="100%"
            alt={''}
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
      {generateError && (
        <p className="mt-2 ml-2 opacity-[50%]">{generateError}</p>
      )}
      {inputImage && (
        <StageButton
          className=""
          onClick={() => {
            setImage(null)
            generateImage()
            if (generateInBG) {
              nextStage()
            }
          }}
        >
          {generating ? 'loading...' : 'Generate'}
        </StageButton>
      )}
      {(currImage && !inputImage) || image ? (
        <StageButton onClick={submitImage}>Next</StageButton>
      ) : (
        <></>
      )}
    </div>
  )
}
