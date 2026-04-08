import { usePrivy } from '@privy-io/react-auth'
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

  // Upload image to Google Cloud Storage
  async function uploadToGoogleStorage(
    file: File
  ): Promise<{ url: string; filename: string }> {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch('/api/google/storage/upload', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error('Failed to upload image to Google Storage')
    }

    const result = await response.json()

    // Extract filename from URL for later deletion
    const urlParts = result.url.split('/')
    const filename = urlParts.slice(4).join('/') // Everything after bucket name

    return { url: result.url, filename }
  }

  // Delete image from Google Cloud Storage
  async function deleteFromGoogleStorage(filename: string) {
    try {
      await fetch('/api/google/storage/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filename }),
      })
    } catch (err) {
      console.error('Failed to delete image from Google Storage:', err)
      // Don't throw here - we don't want deletion failures to break the main flow
    }
  }

  async function generateImage() {
    setIsLoading(true)
    let uploadedFilename: string | null = null

    if (!inputImage) {
      return console.error('inputImage is not defined')
    }

    try {
      // Upload to Google Cloud Storage
      const { url, filename } = await uploadToGoogleStorage(inputImage)
      uploadedFilename = filename

      const accessToken = await getAccessToken()

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const jobId = await Promise.race([
        fetch(generateApiRoute, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ url }),
          signal: controller.signal,
        }).then((res) => res.json()),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Request timed out after 5 seconds')),
            5000
          )
        ),
      ]).finally(() => clearTimeout(timeoutId))

      if (!jobId?.id) {
        throw new Error('Failed to create a comfy icu job')
      }

      await checkJobStatus(jobId.id, uploadedFilename)
    } catch (err: any) {
      console.log(err)
      setIsLoading(false)

      // Clean up uploaded file on error
      if (uploadedFilename) {
        await deleteFromGoogleStorage(uploadedFilename)
      }

      const fittedImage = await fitImage(inputImage, 1024, 1024)
      setImage(fittedImage)
      setError('Unable to generate an image, please try again later.')
    }
  }

  const checkJobStatus = async (jobId: string, uploadedFilename: string) => {
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
      // Clean up uploaded file
      await deleteFromGoogleStorage(uploadedFilename)
      setIsLoading(false) // Add this line
    }

    if (job.status === 'INSUFFICIENT_CREDIT') {
      setError(
        'There was an error generating your image, please contact support.'
      )
      if (inputImage) {
        const fittedImage = await fitImage(inputImage, 1024, 1024)
        setImage(fittedImage)
      }
      // Clean up uploaded file
      await deleteFromGoogleStorage(uploadedFilename)
      setIsLoading(false) // Add this line
    }

    if (job.status === 'COMPLETED') {
      const res = await fetch('/api/image-gen/get-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: job.output[0].url }),
      })

      const blob = await res.blob()
      const fileName = `image_${jobId}.png`
      const file = new File([blob], fileName, { type: blob.type })

      setImage(file)
      setIsLoading(false)

      // Clean up uploaded file after successful generation
      await deleteFromGoogleStorage(uploadedFilename)
    }
  }

  return { generateImage, isLoading, error }
}
