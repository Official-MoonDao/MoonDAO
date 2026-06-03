import { fitImage } from '../utils/images'
import { markAiPortraitReady } from './citizenOnboardingImage'
import { clearPendingImageJob, type PendingImageJob, readPendingImageJob } from './pendingImageJob'

export type GenerationPhase =
  | 'idle'
  | 'uploading'
  | 'queued'
  | 'generating'
  | 'finishing'
  | 'done'
  | 'error'

const POLL_INTERVAL_MS = 3_000
const POLL_MAX_ATTEMPTS = 150
const POLL_TRANSIENT_ERROR_LIMIT = 6
const GET_IMAGE_MAX_RETRIES = 3

const PENDING_STATUSES = new Set(['QUEUED', 'STARTED', 'INIT', 'PENDING'])

const inFlightJobIds = new Set<string>()
const inFlightPromises = new Map<string, Promise<void>>()

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithTimeout(
  input: RequestInfo,
  init: RequestInit = {},
  timeoutMs = 30_000,
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
  }
}

async function deleteFromGoogleStorage(filename: string) {
  try {
    await fetch('/api/image-gen/delete-input', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename }),
    })
  } catch (err) {
    console.error('Failed to delete image from Google Storage:', err)
  }
}

async function fetchJob(generateApiRoute: string, jobId: string): Promise<any> {
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

export type PollComfyJobCallbacks = {
  setPhase: (phase: GenerationPhase) => void
  setImage: (file: File) => void
  setError?: (message: string) => void
  setIsLoading?: (loading: boolean) => void
}

/**
 * Poll comfy.icu until the job finishes. Persists across page navigations when
 * combined with pendingImageJob session storage + resumePendingComfyJob.
 */
export async function pollComfyImageJob(
  generateApiRoute: string,
  jobId: string,
  uploadedFilename: string,
  sourceImage: File | undefined,
  callbacks: PollComfyJobCallbacks,
  generationId?: string,
): Promise<void> {
  if (inFlightJobIds.has(jobId)) {
    const existingPromise = inFlightPromises.get(jobId)
    if (existingPromise) {
      return existingPromise
    }
  }

  const pollPromise = (async () => {
    inFlightJobIds.add(jobId)

    const { setPhase, setImage, setError, setIsLoading } = callbacks
    setIsLoading?.(true)

    let job: any
    let consecutiveErrors = 0
    let attempts = 0

    try {
      while (attempts < POLL_MAX_ATTEMPTS) {
        attempts++
        try {
          job = await fetchJob(generateApiRoute, jobId)
          consecutiveErrors = 0
        } catch (pollErr) {
          consecutiveErrors++
          console.warn(`Poll error (${consecutiveErrors}/${POLL_TRANSIENT_ERROR_LIMIT}):`, pollErr)
          if (consecutiveErrors >= POLL_TRANSIENT_ERROR_LIMIT) {
            throw pollErr
          }
          await sleep(POLL_INTERVAL_MS)
          continue
        }

        if (!job) {
          await sleep(POLL_INTERVAL_MS)
          continue
        }

        if (PENDING_STATUSES.has(job.status)) {
          setPhase(job.status === 'STARTED' ? 'generating' : 'queued')
          await sleep(POLL_INTERVAL_MS)
          continue
        }

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
              30_000,
            )
            if (!res.ok) {
              throw new Error(`Image fetch failed (${res.status})`)
            }
            const blob = await res.blob()
            const fileName = `image_${jobId}.png`
            const file = new File([blob], fileName, { type: blob.type })
            // Bug fix: check if this job is still current before applying result
            const currentJob = readPendingImageJob()
            if (
              generationId ? currentJob?.generationId === generationId : currentJob?.jobId === jobId
            ) {
              setImage(file)
              markAiPortraitReady()
              setPhase('done')
            }
            // Don't mark phase as done if this is a stale job
            return
          } catch (err) {
            lastErr = err
            await sleep(1500 * (attempt + 1))
          }
        }
        throw lastErr ?? new Error('Failed to download generated image')
      }

      if (job.status === 'INSUFFICIENT_CREDIT') {
        setError?.('There was an error generating your image, please contact support.')
      } else {
        console.error('Job failed with status:', job.status)
        setError?.('Unable to generate an image, please try again with a different picture.')
      }

      setPhase('error')
      if (sourceImage) {
        const fittedImage = await fitImage(sourceImage, 1024, 1024)
        const currentJob = readPendingImageJob()
        if (
          generationId ? currentJob?.generationId === generationId : currentJob?.jobId === jobId
        ) {
          setImage(fittedImage)
        }
      }
    } catch (err: any) {
      console.error('Image generation polling failed:', err)
      setPhase('error')
      setError?.('Unable to generate an image, please try again later.')
      if (sourceImage) {
        try {
          const fittedImage = await fitImage(sourceImage, 1024, 1024)
          const currentJob = readPendingImageJob()
          if (
            generationId ? currentJob?.generationId === generationId : currentJob?.jobId === jobId
          ) {
            setImage(fittedImage)
          }
        } catch (fitErr) {
          console.error('Failed to fall back to fitted image:', fitErr)
        }
      }
    } finally {
      inFlightJobIds.delete(jobId)
      inFlightPromises.delete(jobId)
      await deleteFromGoogleStorage(uploadedFilename)
      // Bug fix: only clear if this job is still the current pending job
      const currentJob = readPendingImageJob()
      if (currentJob?.jobId === jobId) {
        clearPendingImageJob()
        setIsLoading?.(false)
      }
    }
  })()

  inFlightPromises.set(jobId, pollPromise)
  return pollPromise
}

/** Resume polling after Privy (or any full navigation) interrupted the React tree. */
export async function resumePendingComfyJob(
  callbacks: PollComfyJobCallbacks,
  sourceImage?: File,
): Promise<boolean> {
  const pending = readPendingImageJob()
  // Only a job that reached the polling stage has a jobId we can poll against.
  if (!pending || !pending.jobId || !pending.uploadedFilename) return false

  await pollComfyImageJob(
    pending.apiRoute,
    pending.jobId,
    pending.uploadedFilename,
    sourceImage,
    callbacks,
    pending.generationId,
  )
  return true
}

export function getPendingImageJob(): PendingImageJob | null {
  return readPendingImageJob()
}
