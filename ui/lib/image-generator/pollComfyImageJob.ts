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

// Nothing can complete while a run is still waiting for a GPU, so poll lazily
// until it actually starts and only then check often enough that we notice the
// finished portrait promptly.
const POLL_INTERVAL_QUEUED_MS = 3_000
const POLL_INTERVAL_ACTIVE_MS = 1_000
const POLL_ERROR_BACKOFF_MS = 3_000
// Budgets are wall-clock rather than attempt counts: tying them to the poll
// interval meant tightening the interval silently shortened both the overall
// timeout and how long a comfy.icu blip could last before we gave up.
const POLL_DEADLINE_MS = 450_000
const POLL_ERROR_GRACE_MS = 20_000
const GET_IMAGE_MAX_RETRIES = 3

const COMFY_OUTPUT_HOSTNAME = 'r2.comfy.icu'

const COMFY_SUCCESS_STATUS = 'COMPLETED'
const COMFY_CREDIT_STATUS = 'INSUFFICIENT_CREDIT'
const COMFY_FAILURE_STATUSES = new Set([
  'ERROR',
  'FAILED',
  'CANCELLED',
  'CANCELED',
  'TIMEOUT',
])
const COMFY_GENERATING_STATUSES = new Set(['STARTED', 'RUNNING'])

export type ComfyJobClass =
  | 'pending'
  | 'completed'
  | 'insufficient_credit'
  | 'failed'

/**
 * Classify a comfy.icu run status. Only known terminal statuses stop polling.
 * In-progress and unknown statuses stay pending so a provider change (e.g.
 * adding RUNNING on canary workers) cannot mark a live job as failed.
 */
export function classifyComfyJobStatus(status: unknown): ComfyJobClass {
  if (status === COMFY_SUCCESS_STATUS) return 'completed'
  if (status === COMFY_CREDIT_STATUS) return 'insufficient_credit'
  if (typeof status === 'string' && COMFY_FAILURE_STATUSES.has(status)) {
    return 'failed'
  }
  return 'pending'
}

export function isComfyJobPending(status: unknown): boolean {
  return classifyComfyJobStatus(status) === 'pending'
}

export function isComfyJobGenerating(status: unknown): boolean {
  return typeof status === 'string' && COMFY_GENERATING_STATUSES.has(status)
}

export function pollIntervalForStatus(status: unknown): number {
  return isComfyJobGenerating(status) ? POLL_INTERVAL_ACTIVE_MS : POLL_INTERVAL_QUEUED_MS
}

/**
 * Whether the browser can pull a finished portrait straight from comfy.icu's
 * CDN instead of proxying it through our own API. Mirrors the server-side
 * allowlist in `pages/api/image-gen/get-image.ts` so both paths accept exactly
 * the same URLs.
 */
export function canFetchComfyOutputDirectly(url: unknown): boolean {
  if (typeof url !== 'string' || !url) return false
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:') return false
  if (parsed.port !== '') return false
  return parsed.hostname === COMFY_OUTPUT_HOSTNAME
}

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

export function comfyJobStatusUrl(generateApiRoute: string, jobId: string): string {
  const separator = generateApiRoute.includes('?') ? '&' : '?'
  return `${generateApiRoute}${separator}id=${encodeURIComponent(jobId)}`
}

/** Normalize a single-run or legacy list response into the matching job. */
export function parseComfyJobStatus(payload: unknown, jobId: string): any | undefined {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const job = payload as { id?: string }
    if (job.id && job.id !== jobId) {
      throw new Error('Job status response did not match the requested job')
    }
    return payload
  }
  if (Array.isArray(payload)) {
    return payload.find((j: any) => j?.id === jobId)
  }
  throw new Error('Unexpected job status response shape')
}

async function fetchJob(generateApiRoute: string, jobId: string): Promise<any> {
  const res = await fetchWithTimeout(comfyJobStatusUrl(generateApiRoute, jobId), {}, 20_000)
  if (!res.ok) {
    throw new Error(`Job status request failed (${res.status})`)
  }
  return parseComfyJobStatus(await res.json(), jobId)
}

function looksLikeImageBlob(blob: Blob): boolean {
  return blob.size > 0 && blob.type.startsWith('image/')
}

/**
 * The CDN sends `access-control-allow-origin: *`, so going straight to it saves
 * a full round trip of the image through our own server. The proxy stays as a
 * fallback for anything that blocks or intercepts the cross-origin request —
 * captive portals happily answer 200 with a login page, so the response has to
 * actually look like an image before we trust it.
 */
async function downloadGeneratedImage(outputUrl: string): Promise<Blob> {
  if (canFetchComfyOutputDirectly(outputUrl)) {
    try {
      const direct = await fetchWithTimeout(
        outputUrl,
        { mode: 'cors', credentials: 'omit' },
        30_000,
      )
      if (direct.ok) {
        const blob = await direct.blob()
        if (looksLikeImageBlob(blob)) return blob
        console.warn(`Direct portrait download returned ${blob.type || 'no'} content, using proxy`)
      } else {
        console.warn(`Direct portrait download failed (${direct.status}), using proxy`)
      }
    } catch (err) {
      console.warn('Direct portrait download failed, using proxy:', err)
    }
  }

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
  return res.blob()
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
    let firstErrorAt: number | null = null
    const deadline = Date.now() + POLL_DEADLINE_MS

    try {
      while (Date.now() < deadline) {
        try {
          job = await fetchJob(generateApiRoute, jobId)
          firstErrorAt = null
        } catch (pollErr) {
          if (firstErrorAt === null) firstErrorAt = Date.now()
          const failingFor = Date.now() - firstErrorAt
          console.warn(`Poll error (failing for ${failingFor}ms):`, pollErr)
          if (failingFor >= POLL_ERROR_GRACE_MS) {
            throw pollErr
          }
          await sleep(POLL_ERROR_BACKOFF_MS)
          continue
        }

        if (!job) {
          await sleep(POLL_INTERVAL_QUEUED_MS)
          continue
        }

        if (isComfyJobPending(job.status)) {
          setPhase(isComfyJobGenerating(job.status) ? 'generating' : 'queued')
          await sleep(pollIntervalForStatus(job.status))
          continue
        }

        break
      }

      if (!job || isComfyJobPending(job?.status)) {
        throw new Error('Image generation timed out')
      }

      if (classifyComfyJobStatus(job.status) === 'completed') {
        const outputUrl = job?.output?.[0]?.url
        if (!outputUrl) {
          throw new Error('Job completed without an output image')
        }

        setPhase('finishing')
        let lastErr: any
        for (let attempt = 0; attempt < GET_IMAGE_MAX_RETRIES; attempt++) {
          try {
            const blob = await downloadGeneratedImage(outputUrl)
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

      if (classifyComfyJobStatus(job.status) === 'insufficient_credit') {
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
