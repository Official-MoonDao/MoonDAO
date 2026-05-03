import { useState } from 'react'
import { fitImage } from '../utils/images'

// Tunables for the comfy.icu polling pipeline. These default to fairly generous
// values because the underlying GPU service is occasionally slow to accept jobs
// and to start running them, especially during a cold start. Anything tighter
// than this caused the "Unable to generate an image" error to fire on jobs that
// would otherwise have completed successfully.
const CREATE_JOB_TIMEOUT_MS = 45_000 // POST /api/image-gen/<route>
const CREATE_JOB_MAX_RETRIES = 2 // 1 initial attempt + this many retries
const POLL_INTERVAL_MS = 5_000
const POLL_MAX_ATTEMPTS = 90 // ≈ 7.5 minutes
const POLL_TRANSIENT_ERROR_LIMIT = 6 // consecutive failed polls before giving up
const GET_IMAGE_MAX_RETRIES = 3

const PENDING_STATUSES = new Set(['QUEUED', 'STARTED', 'INIT', 'PENDING'])

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithTimeout(
  input: RequestInfo,
  init: RequestInit = {},
  timeoutMs = 30_000
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
  }
}

export default function useImageGenerator(
  generateApiRoute: string,
  inputImage: File | undefined,
  setImage: Function
) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>()

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

  // Create the comfy.icu job, retrying on transient failures.
  async function createJob(url: string): Promise<string> {
    let lastError: any
    for (let attempt = 0; attempt <= CREATE_JOB_MAX_RETRIES; attempt++) {
      try {
        const res = await fetchWithTimeout(
          generateApiRoute,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
          },
          CREATE_JOB_TIMEOUT_MS
        )

        if (!res.ok) {
          // 5xx is potentially transient; 4xx is not.
          const body = await res.text().catch(() => '')
          const err = new Error(
            `Job creation failed (${res.status}): ${body || res.statusText}`
          )
          if (res.status >= 500 && attempt < CREATE_JOB_MAX_RETRIES) {
            lastError = err
            await sleep(1500 * (attempt + 1))
            continue
          }
          throw err
        }

        const data = await res.json().catch(() => null)
        if (!data?.id) {
          throw new Error('Comfy.icu did not return a job id')
        }
        return data.id
      } catch (err: any) {
        lastError = err
        const isAbort = err?.name === 'AbortError'
        const isNetwork = err instanceof TypeError
        if (
          (isAbort || isNetwork) &&
          attempt < CREATE_JOB_MAX_RETRIES
        ) {
          await sleep(1500 * (attempt + 1))
          continue
        }
        throw err
      }
    }
    throw lastError ?? new Error('Failed to create a comfy.icu job')
  }

  async function generateImage(overrideInput?: File) {
    const sourceImage = overrideInput ?? inputImage
    if (!sourceImage) {
      console.error('inputImage is not defined')
      return
    }

    setError(undefined)
    setIsLoading(true)
    let uploadedFilename: string | null = null

    try {
      // Upload to Google Cloud Storage
      const { url, filename } = await uploadToGoogleStorage(sourceImage)
      uploadedFilename = filename

      const jobId = await createJob(url)
      await checkJobStatus(jobId, uploadedFilename, sourceImage)
    } catch (err: any) {
      console.error('Image generation failed:', err)

      // Clean up uploaded file on error
      if (uploadedFilename) {
        await deleteFromGoogleStorage(uploadedFilename)
      }

      try {
        const fittedImage = await fitImage(sourceImage, 1024, 1024)
        setImage(fittedImage)
      } catch (fitErr) {
        console.error('Failed to fall back to fitted image:', fitErr)
      }
      setError('Unable to generate an image, please try again later.')
      setIsLoading(false)
    }
  }

  // Poll comfy.icu via our proxy route, tolerating transient network errors.
  async function fetchJob(jobId: string): Promise<any> {
    const res = await fetchWithTimeout(generateApiRoute, {}, 20_000)
    if (!res.ok) {
      throw new Error(`Job status request failed (${res.status})`)
    }
    const jobs = await res.json()
    if (!Array.isArray(jobs)) {
      throw new Error('Unexpected job status response shape')
    }
    return jobs.find((j: any) => j?.id === jobId)
  }

  const checkJobStatus = async (
    jobId: string,
    uploadedFilename: string,
    sourceImage: File
  ) => {
    let job: any
    let consecutiveErrors = 0
    let attempts = 0

    try {
      while (attempts < POLL_MAX_ATTEMPTS) {
        attempts++
        try {
          job = await fetchJob(jobId)
          consecutiveErrors = 0
        } catch (pollErr) {
          consecutiveErrors++
          console.warn(
            `Poll error (${consecutiveErrors}/${POLL_TRANSIENT_ERROR_LIMIT}):`,
            pollErr
          )
          if (consecutiveErrors >= POLL_TRANSIENT_ERROR_LIMIT) {
            throw pollErr
          }
          await sleep(POLL_INTERVAL_MS)
          continue
        }

        // Job not yet visible in the runs list — keep polling.
        if (!job) {
          await sleep(POLL_INTERVAL_MS)
          continue
        }

        if (PENDING_STATUSES.has(job.status)) {
          await sleep(POLL_INTERVAL_MS)
          continue
        }

        // Terminal status reached.
        break
      }

      if (!job || PENDING_STATUSES.has(job?.status)) {
        throw new Error('Image generation timed out')
      }

      if (job.status === 'COMPLETED') {
        const outputUrl = job?.output?.[0]?.url
        if (!outputUrl) {
          throw new Error('Job completed without an output image')
        }

        let lastErr: any
        for (let attempt = 0; attempt < GET_IMAGE_MAX_RETRIES; attempt++) {
          try {
            const res = await fetchWithTimeout(
              '/api/image-gen/get-image',
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: outputUrl }),
              },
              30_000
            )
            if (!res.ok) {
              throw new Error(`Image fetch failed (${res.status})`)
            }
            const blob = await res.blob()
            const fileName = `image_${jobId}.png`
            const file = new File([blob], fileName, { type: blob.type })
            setImage(file)
            return
          } catch (err) {
            lastErr = err
            await sleep(1500 * (attempt + 1))
          }
        }
        throw lastErr ?? new Error('Failed to download generated image')
      }

      if (job.status === 'INSUFFICIENT_CREDIT') {
        setError(
          'There was an error generating your image, please contact support.'
        )
      } else {
        // ERROR, FAILED, CANCELED, or any unknown terminal status
        console.error('Job failed with status:', job.status)
        setError(
          'Unable to generate an image, please try again with a different picture.'
        )
      }

      const fittedImage = await fitImage(sourceImage, 1024, 1024)
      setImage(fittedImage)
    } catch (err: any) {
      console.error('Image generation polling failed:', err)
      setError('Unable to generate an image, please try again later.')
      try {
        const fittedImage = await fitImage(sourceImage, 1024, 1024)
        setImage(fittedImage)
      } catch (fitErr) {
        console.error('Failed to fall back to fitted image:', fitErr)
      }
    } finally {
      await deleteFromGoogleStorage(uploadedFilename)
      setIsLoading(false)
    }
  }

  return { generateImage, isLoading, error }
}
