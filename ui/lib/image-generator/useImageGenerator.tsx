import { useEffect, useRef, useState } from 'react'
import { compressImageForUpload, fitImage } from '../utils/images'
import {
  clearPendingImageJob,
  markPendingImageJobPolling,
  markPendingImageJobUploading,
} from './pendingImageJob'
import {
  pollComfyImageJob,
  type GenerationPhase,
} from './pollComfyImageJob'

export type { GenerationPhase }

// Tunables for the comfy.icu polling pipeline. These default to fairly generous
// values because the underlying GPU service is occasionally slow to accept jobs
// and to start running them, especially during a cold start. Anything tighter
// than this caused the "Unable to generate an image" error to fire on jobs that
// would otherwise have completed successfully.
const CREATE_JOB_TIMEOUT_MS = 45_000 // POST /api/image-gen/<route>
const CREATE_JOB_MAX_RETRIES = 2 // 1 initial attempt + this many retries
const UPLOAD_MAX_ATTEMPTS = 3

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
  const setPhase = (value: GenerationPhase) => {
    if (isMountedRef.current) {
      _setPhase((prev) => (prev === value ? prev : value))
    }
  }

  async function uploadToGoogleStorage(
    file: File
  ): Promise<{ url: string; filename: string }> {
    let lastError: any
    for (let attempt = 1; attempt <= UPLOAD_MAX_ATTEMPTS; attempt++) {
      let response: Response
      try {
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

    // Generate unique ID to track this generation attempt
    const generationId = `gen_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    // Persist before upload so Privy redirect during upload can resume/restart.
    markPendingImageJobUploading(generateApiRoute, generationId)

    try {
      const { url, filename } = await uploadToGoogleStorage(sourceImage)
      uploadedFilename = filename

      setPhase('queued')
      const jobId = await createJob(url)

      markPendingImageJobPolling(jobId, filename, generateApiRoute, generationId)

      await pollComfyImageJob(generateApiRoute, jobId, filename, sourceImage, {
        setPhase,
        setImage: (file) => setImage(file),
        setError,
        setIsLoading,
      }, generationId)
    } catch (err: any) {
      console.error('Image generation failed:', err)
      setPhase('error')
      clearPendingImageJob()

      if (uploadedFilename) {
        try {
          await fetch('/api/image-gen/delete-input', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: uploadedFilename }),
          })
        } catch {
          /* ignore */
        }
      }

      try {
        const fittedImage = await fitImage(sourceImage, 1024, 1024)
        setImage(fittedImage)
      } catch (fitErr) {
        console.error('Failed to fall back to fitted image:', fitErr)
      }
      const message: string =
        typeof err?.message === 'string' && err.message
          ? err.message
          : 'Unable to generate an image, please try again later.'
      setError(
        message.startsWith('Failed to upload')
          ? message
          : 'Unable to generate an image, please try again later.',
      )
      setIsLoading(false)
    }
  }

  return { generateImage, isLoading, error, phase }
}
