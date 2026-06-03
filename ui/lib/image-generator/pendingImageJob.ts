export const CITIZEN_PENDING_IMAGE_JOB_KEY = 'CreateCitizen_pendingImageJob'

/** Max age before we stop resuming a job (slightly above client poll ceiling). */
export const PENDING_IMAGE_JOB_TTL_MS = 8 * 60 * 1000

export type PendingImageJobStatus = 'uploading' | 'polling'

export type PendingImageJob = {
  apiRoute: string
  startedAt: number
  status: PendingImageJobStatus
  jobId?: string
  uploadedFilename?: string
}

export function savePendingImageJob(job: PendingImageJob) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(CITIZEN_PENDING_IMAGE_JOB_KEY, JSON.stringify(job))
  } catch {
    /* ignore */
  }
}

export function readPendingImageJob(): PendingImageJob | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(CITIZEN_PENDING_IMAGE_JOB_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.apiRoute || !parsed?.startedAt) return null
    if (parsed.status === 'polling') {
      if (parsed.jobId && parsed.uploadedFilename) return parsed as PendingImageJob
      return null
    }
    if (parsed.status === 'uploading') return parsed as PendingImageJob
  } catch {
    /* ignore */
  }
  return null
}

export function clearPendingImageJob() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(CITIZEN_PENDING_IMAGE_JOB_KEY)
  } catch {
    /* ignore */
  }
}

export function isPendingImageJobStale(job: PendingImageJob): boolean {
  return Date.now() - (job.startedAt || 0) > PENDING_IMAGE_JOB_TTL_MS
}

export function markPendingImageJobPolling(
  jobId: string,
  uploadedFilename: string,
  apiRoute: string
) {
  savePendingImageJob({
    apiRoute,
    startedAt: Date.now(),
    status: 'polling',
    jobId,
    uploadedFilename,
  })
}

export function markPendingImageJobUploading(apiRoute: string) {
  // Dynamic import avoided — caller clears AI flag when starting a new job.
  savePendingImageJob({
    apiRoute,
    startedAt: Date.now(),
    status: 'uploading',
  })
}
