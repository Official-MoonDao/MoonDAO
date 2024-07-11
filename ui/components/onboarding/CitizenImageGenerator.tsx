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
  generateInBG,
  stage,
}: any) {
  const { getAccessToken } = usePrivy()
  const [userImage, setUserImage] = useState<File>()
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
    if (generateInBG) nextStage()
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
      const res = await fetch(job.output[0].url)
      const blob = await res.blob()

      // Create a File object from the blob
      const fileName = `image_${jobId}.png` // You can customize the file name
      const file = new File([blob], fileName, { type: blob.type })

      // Set the image as a File object
      setImage(file)
    } else {
      setTimeout(() => {
        checkJobStatus(jobId)
      }, 15000)
    }
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
        <StageButton onClick={generateImage}>Generate</StageButton>
        {(currImage && !userImage) || citizenImage ? (
          <StageButton className="" onClick={submitImage}>
            Save Design
          </StageButton>
        ) : (
          <></>
        )}
      </div>
      <div
        id="citizenPic"
        className="w-[90vw] rounded-[5vmax] rounded-tl-[20px] h-[90vw] md:w-[430px] md:h-[430px] lg:w-[600px] lg:h-[600px] bg-white bg-cover justify-left relative flex"
      >
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
            {citizenImage ? (
              <Image
                src={URL.createObjectURL(citizenImage)}
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
