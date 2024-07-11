// Team Image Generator
import { usePrivy } from '@privy-io/react-auth'
import { MediaRenderer } from '@thirdweb-dev/react'
import html2canvas from 'html2canvas'
import { useS3Upload } from 'next-s3-upload'
import Image from 'next/image'
import { useState } from 'react'
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
  const [generating, setGenerating] = useState(false)

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

    const accessToken = await getAccessToken()

    const jobId = await fetch('/api/image-gen/citizen-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ url }),
    })
      .then((res) => res.json())
      .catch((e) => console.error(e))

    setGenerating(true)
    if (generateInBG) nextStage()
    await checkJobStatus(jobId.id)
  }

  const checkJobStatus = async (jobId: string) => {
    let jobs = await fetch('/api/image-gen/citizen-image').then((res) =>
      res.json()
    )

    let job = jobs.find((job: any) => job.id === jobId)

    while (
      job.status === 'QUEUED' ||
      job.status === 'STARTED' ||
      job.status === 'INIT'
    ) {
      await new Promise((resolve) => setTimeout(resolve, 7000))
      jobs = await fetch('/api/image-gen/citizen-image').then((res) =>
        res.json()
      )
      job = jobs.find((job: any) => job.id === jobId)
      console.log(job)
    }

    if (job.status === 'ERROR') {
      console.error('job failed')
    }

    if (job.status === 'COMPLETED') {
      const res = await fetch('/api/image-gen/get-citizen-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: job.output[0].url }),
      })
      //get the text from the res
      const blob = await res.blob()

      // Create a File object from the blob
      const fileName = `image_${jobId}.png` // You can customize the file name
      const file = new File([blob], fileName, { type: blob.type })
      // Set the image as a File object
      setImage(file)
      setGenerating(false)
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
                src={URL.createObjectURL(userImage)}
                layout="fill"
                objectFit="contain"
                className="mix-blend-multiply"
                alt={''}
              />
            ) : generating ? (
              <Image
                src={'/assets/MoonDAO-Loading-Animation.svg'}
                layout="fill"
                objectFit="contain"
                className="mix-blend-multiply"
                alt={''}
              />
            ) : (
              <Image
                src={URL.createObjectURL(userImage)}
                layout="fill"
                objectFit="contain"
                className="mix-blend-multiply"
                alt={''}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
