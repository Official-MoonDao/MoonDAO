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
      const errorBody = await response.text().catch(() => 'Unknown error')
      console.error(`❌ GCS upload failed (${response.status}):`, errorBody)
      throw new Error(`Failed to upload image to Google Storage: ${response.status} ${errorBody}`)
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

  async function generateImage(imageOverride?: File) {
    setIsLoading(true)
    let uploadedFilename: string | null = null

    const imageToUse = imageOverride || inputImage
    if (!imageToUse) {
      setIsLoading(false)
      setError('Please select an image before generating.')
      console.error('inputImage is not defined')
      return
    }

    try {
      // Upload to Google Cloud Storage
      const { url, filename } = await uploadToGoogleStorage(imageToUse)
      uploadedFilename = filename

      const accessToken = await getAccessToken()

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000)

      const jobId = await fetch(generateApiRoute, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ url }),
        signal: controller.signal,
      })
        .then((res) => res.json())
        .finally(() => clearTimeout(timeoutId))

      if (!jobId?.id) {
        throw new Error('Failed to create a comfy icu job')
      }

      await checkJobStatus(jobId.id, uploadedFilename, imageToUse)
    } catch (err: any) {
      console.error('❌ Image generation failed:', err?.message || err)
      setIsLoading(false)

      // Clean up uploaded file on error
      if (uploadedFilename) {
        await deleteFromGoogleStorage(uploadedFilename)
      }

      try {
        const fittedImage = await fitImage(imageToUse, 1024, 1024)
        setImage(fittedImage)
      } catch (fitErr) {
        console.error('❌ fitImage fallback also failed:', fitErr)
      }
      setError('Unable to generate an image, please try again later.')
    }
  }

  const checkJobStatus = async (jobId: string, uploadedFilename: string, imageToUse: File) => {
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
      if (imageToUse) {
        const fittedImage = await fitImage(imageToUse, 1024, 1024)
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
      if (imageToUse) {
        const fittedImage = await fitImage(imageToUse, 1024, 1024)
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
