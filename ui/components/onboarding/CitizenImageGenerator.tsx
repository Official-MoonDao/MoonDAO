// Team Image Generator
import { usePrivy } from '@privy-io/react-auth'
import { MediaRenderer } from '@thirdweb-dev/react'
import html2canvas from 'html2canvas'
import { useS3Upload } from 'next-s3-upload'
import Head from 'next/head'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { StageButton } from './StageButton'

export function ImageGenerator({
  currImage,
  citizenImage,
  setImage,
  nextStage,
  stage,
}: any) {
  const { getAccessToken } = usePrivy()
  const [userImage, setUserImage] = useState<File>()
  const [generatedImage, setGeneratedImage] = useState<string>()
  const { FileInput, openFileDialog, uploadToS3 } = useS3Upload()

  async function submitImage() {
    if (!document.getElementById('citizenPic'))
      return console.error('citizenPic is not defined')
    // @ts-expect-error
    await html2canvas(document.getElementById('citizenPic')).then((canvas) => {
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
      nextStage()
    })
  }

  async function generateImage() {
    if (!userImage) {
      return console.error('userImage is not defined')
    }

    const { url } = await uploadToS3(userImage)
    console.log('url', url)

    const accessToken = await getAccessToken()

    const jobId = await fetch('/api/imageGen/citizenImage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ url }),
    })
      .then((res) => res.json())
      .catch((e) => console.error(e))

    console.log('jobId', jobId)
    await checkJobStatus(jobId.id)
  }

  const checkJobStatus = async (jobId: string) => {
    const jobs = await fetch('/api/imageGen/citizenImage').then((res) =>
      res.json()
    )

    const job = jobs.find((job: any) => job.id === jobId)

    if (job.status === 'ERROR') {
      console.error('job failed')
    }

    if (job.status === 'COMPLETED') {
      setGeneratedImage(job.output[0].url)
    } else {
      setTimeout(() => {
        checkJobStatus(jobId)
      }, 15000)
    }
  }

  return (
    <div className="animate-fadeIn flex flex-col">
      <div className="mb-12 flex items-start md:items-center flex-col gap-4 md:flex-row">
        <input
          className="text-white text-opacity-80"
          type="file"
          accept="image/*"
          onChange={(e: any) => setUserImage(e.target.files[0])}
        />
        {userImage &&
          (citizenImage ? (
            <StageButton className="" onClick={submitImage}>
              Save Design
            </StageButton>
          ) : (
            <StageButton onClick={generateImage}>Generate</StageButton>
          ))}
        {!userImage && currImage && (
          <StageButton className="" onClick={submitImage}>
            Save Design
          </StageButton>
        )}
      </div>
      <div
        id="citizenPic"
        className="w-[90vw] rounded-[5vmax] rounded-tl-[20px] h-[90vw] md:w-[600px] md:h-[600px] bg-white bg-cover justify-left relative flex"
      >
        {/* <div
          id="user-image"
          style={{
            backgroundImage: `url(${
              userImage
                ? URL.createObjectURL(userImage)
                : '/assets/image-placeholder.svg'
            })`,
          }}
          className="h-[48%] w-[75%] mt-[29%] ml-[15%] bg-contain bg-no-repeat bg-center mix-blend-multiply"
        ></div> */}
        {currImage && !userImage && (
          <MediaRenderer
            src={currImage}
            className="mix-blend-multiply"
            width="100%"
            height="100%"
            alt={''}
          />
        )}
        {userImage && (
          <>
            {generatedImage ? (
              <Image
                src={generatedImage}
                layout="fill"
                objectFit="contain"
                className="mix-blend-multiply"
                alt={''}
              />
            ) : (
              userImage && (
                <Image
                  src={URL.createObjectURL(userImage)}
                  layout="fill"
                  objectFit="contain"
                  className="mix-blend-multiply"
                  alt={''}
                />
              )
            )}
          </>
        )}
      </div>
    </div>
  )
}
