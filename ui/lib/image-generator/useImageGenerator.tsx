import { usePrivy } from '@privy-io/react-auth'
import { useS3Upload } from 'next-s3-upload'
import { useState } from 'react'
import { fitImage } from '../utils/images'

export default function useImageGenerator(
  generateApiRoute: string,
  inputImage: File | undefined,
  setImage: Function
) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>()

  const { getAccessToken } = usePrivy()
  const { uploadToS3 } = useS3Upload()

  async function generateImage() {
    setIsLoading(true)

    if (!inputImage) {
      return console.error('inputImage is not defined')
    }

    try {
      const { url } = await uploadToS3(inputImage)

      const accessToken = await getAccessToken()

      const jobId = await fetch(generateApiRoute, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ url }),
      })
        .then((res) => res.json())
        .catch((e) => console.error(e))

      if (!jobId?.id) {
        throw new Error('Failed to create a comfy icu job')
      }

      await checkJobStatus(jobId.id)
    } catch (err: any) {
      console.log(err)
      setIsLoading(false)
      const fittedImage = await fitImage(inputImage, 1024, 1024)
      setImage(fittedImage)
      setError('Unable to generate an image, please try again later.')
    }
  }

  const checkJobStatus = async (jobId: string) => {
    let jobs = await fetch(generateApiRoute).then((res) => res.json())

    let job = jobs.find((job: any) => job.id === jobId)

    while (
      job.status === 'QUEUED' ||
      job.status === 'STARTED' ||
      job.status === 'INIT'
    ) {
      await new Promise((resolve) => setTimeout(resolve, 7000))
      jobs = await fetch(generateApiRoute).then((res) => res.json())
      job = jobs.find((job: any) => job.id === jobId)
      console.log(job)
    }

    if (job.status === 'ERROR') {
      console.error('job failed')
      setError(
        'Unable to generate an image, please try again with a different picture.'
      )
      if (inputImage) {
        const fittedImage = await fitImage(inputImage, 1024, 1024)
        setImage(fittedImage)
      }
    }

    if (job.status === 'COMPLETED') {
      const res = await fetch('/api/image-gen/get-image', {
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
      setIsLoading(false)
    }
  }

  return { generateImage, isLoading, error }
}
