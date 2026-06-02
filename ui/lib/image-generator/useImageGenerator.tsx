import { useEffect, useRef, useState } from 'react'
import { compressImageForUpload, fitImage } from '../utils/images'

// Tunables for the comfy.icu polling pipeline. These default to fairly generous
// values because the underlying GPU service is occasionally slow to accept jobs
// and to start running them, especially during a cold start. Anything tighter
// than this caused the "Unable to generate an image" error to fire on jobs that
// would otherwise have completed successfully.
const CREATE_JOB_TIMEOUT_MS = 45_000 // POST /api/image-gen/<route>
const CREATE_JOB_MAX_RETRIES = 2 // 1 initial attempt + this many retries
// A shorter poll interval makes the UI notice completion sooner (the generation
// itself is the slow part, not our polling). Attempts are bumped to keep the
// overall ceiling at ~7.5 minutes.
const POLL_INTERVAL_MS = 3_000
const POLL_MAX_ATTEMPTS = 150 // ≈ 7.5 minutes
const POLL_TRANSIENT_ERROR_LIMIT = 6 // consecutive failed polls before giving up
const GET_IMAGE_MAX_RETRIES = 3

const PENDING_STATUSES = new Set(['QUEUED', 'STARTED', 'INIT', 'PENDING'])

// Coarse, user-facing phases of the generation pipeline so the UI can show
// meaningful progress and set expectations during the (cold-start heavy) wait.
export type GenerationPhase =
  | 'idle'
  | 'uploading'
  | 'queued'
  | 'generating'
  | 'finishing'
  | 'done'
  | 'error'

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
  const [isLoading, _setIsLoading] = useState(false)
  const [error, _setError] = useState<string>()
  const [phase, _setPhase] = useState<GenerationPhase>('idle')

  // The onboarding "generate in background" flow can advance (and unmount this
  // hook's owner) while a job is still uploading/polling. Guard our internal
  // state setters so they no-op after unmount, while leaving `setImage` (the
  // parent-provided callback) free to deliver the result.
  const isMountedRef = useRef(true)
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const setIsLoading = (value: boolean) => {
    if (isMountedRef.current) _setIsLoading(value)
  }
  const setError = (value?: string) => {
    if (isMountedRef.current) _setError(value)
  }
  // Only re-render when the phase actually changes. Polling calls this on every
  // tick (often with the same value), and the functional updater lets React
  // bail out of a render when the value is unchanged.
  const setPhase = (value: GenerationPhase) => {
    if (isMountedRef.current) {
      _setPhase((prev) => (prev === value ? prev : value))
    }
  }

  // Upload image to Google Cloud Storage. Retries on transient errors
  // (network blips / 5xx) but bails immediately on auth/validation failures.
  const UPLOAD_MAX_ATTEMPTS = 3

  async function uploadToGoogleStorage(
    file: File
  ): Promise<{ url: string; filename: string }> {
    let lastError: any
    for (let attempt = 1; attempt <= UPLOAD_MAX_ATTEMPTS; attempt++) {
      let response: Response
      try {
        // Vercel serverless functions cap request bodies at ~4.5 MB; downscale
        // large photos client-side before they ever hit the upload route.
        const prepared = await compressImageForUpload(file)
        const formData = new FormData()
        formData.append(
          'file',
          prepared,
          (prepared as File).name || file.name
        )
        response = await fetchWithTimeout(
          '/api/image-gen/upload-input',
          { method: 'POST', body: formData },
          60_000
        )
      } catch (err: any) {
        lastError = err
        if (attempt < UPLOAD_MAX_ATTEMPTS) {
          await sleep(1500 * attempt)
          continue
        }
        throw new Error(
          `Failed to upload image to Google Storage: ${
            err?.message || 'network error'
          }`
        )
      }

      if (response.ok) {
        const result = await response.json().catch(() => null)
        if (!result?.url) {
          throw new Error(
            'Failed to upload image to Google Storage: malformed response'
          )
        }
        const filename =
          typeof result.filename === 'string'
            ? result.filename
            : result.url.split('/').slice(4).join('/')
        return { url: result.url, filename }
      }

      // Try to surface the server-side reason.
      let detail = ''
      try {
        const body = await response.clone().json()
        detail = body?.details || body?.error || ''
      } catch {
        try {
          detail = await response.text()
        } catch {
          /* ignore */
        }
      }

      // Don't retry on auth or client errors — they won't get better.
      if (response.status < 500 || attempt === UPLOAD_MAX_ATTEMPTS) {
        throw new Error(
          `Failed to upload image to Google Storage (${response.status})${
            detail ? `: ${detail}` : ''
          }`
        )
      }

      lastError = new Error(
        `Upload failed (${response.status})${detail ? `: ${detail}` : ''}`
      )
      await sleep(1500 * attempt)
    }
    throw lastError ?? new Error('Failed to upload image to Google Storage')
  }

  // Delete image from Google Cloud Storage
  async function deleteFromGoogleStorage(filename: string) {
    try {
      await fetch('/api/image-gen/delete-input', {
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
    setPhase('uploading')
    let uploadedFilename: string | null = null

    try {
      // Upload to Google Cloud Storage
      const { url, filename } = await uploadToGoogleStorage(sourceImage)
      uploadedFilename = filename

      setPhase('queued')
      const jobId = await createJob(url)
      await checkJobStatus(jobId, uploadedFilename, sourceImage)
    } catch (err: any) {
      console.error('Image generation failed:', err)
      setPhase('error')

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
      // If the upload helper produced a user-actionable message, surface it.
      const message: string =
        typeof err?.message === 'string' && err.message
          ? err.message
          : 'Unable to generate an image, please try again later.'
      setError(
        message.startsWith('Failed to upload') ? message : 'Unable to generate an image, please try again later.',
      )
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
          setPhase(job.status === 'STARTED' ? 'generating' : 'queued')
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

        setPhase('finishing')
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
            setPhase('done')
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

      setPhase('error')
      const fittedImage = await fitImage(sourceImage, 1024, 1024)
      setImage(fittedImage)
    } catch (err: any) {
      console.error('Image generation polling failed:', err)
      setPhase('error')
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

  return { generateImage, isLoading, error, phase }
}
