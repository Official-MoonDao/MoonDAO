/** Session flag: set only when comfy.icu returns the final AI portrait. */
export const AI_PORTRAIT_READY_SESSION_KEY = 'CreateCitizen_aiPortraitReady'

export function markAiPortraitReady() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(AI_PORTRAIT_READY_SESSION_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function clearAiPortraitReady() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(AI_PORTRAIT_READY_SESSION_KEY)
  } catch {
    /* ignore */
  }
}

export function isAiPortraitReady(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return sessionStorage.getItem(AI_PORTRAIT_READY_SESSION_KEY) === '1'
  } catch {
    return false
  }
}

export function hasAiPortraitImage(
  citizenImage: File | undefined,
  croppedInputImage: File | undefined
): boolean {
  return !!citizenImage && (!croppedInputImage || citizenImage !== croppedInputImage)
}

/**
 * Comfy downloads are named `image_<jobId>.png`. Storage restore re-encodes
 * that file as `image_<jobId>.jpg`. Job ids are 21-char nanoids
 * (`VE52rnl_BVdbgou9tQbEF`, `3AIdyeK1zmdW9NaWw-46u`) — not `image_1234.jpg`.
 * Crop / fitImage keep the upload filename, so a short `image_*` name is a
 * user photo, not a finished portrait.
 */
const COMFY_PORTRAIT_FILENAME_RE = /^image_[A-Za-z0-9_-]{21}\.(png|jpe?g)$/i

export function isGeneratedAiPortraitFile(file?: File | null): boolean {
  return !!file?.name && COMFY_PORTRAIT_FILENAME_RE.test(file.name)
}

/** Restore-time check: Comfy filename, and not the same payload as the crop. */
export function restoredCitizenImageLooksLikeAi(
  citizen: { name: string; data: string },
  cropped?: { name: string; data: string } | null
): boolean {
  if (!COMFY_PORTRAIT_FILENAME_RE.test(citizen.name)) return false
  if (cropped && cropped.name === citizen.name && cropped.data === citizen.data) {
    return false
  }
  return true
}

export function isUsableAiPortrait(
  citizenImage: File | undefined,
  croppedInputImage: File | undefined,
  aiPortraitReady: boolean
): boolean {
  if (!hasAiPortraitImage(citizenImage, croppedInputImage) || !citizenImage) {
    return false
  }
  if (aiPortraitReady) return true
  if (!isGeneratedAiPortraitFile(citizenImage)) return false
  // Same name as the crop means this is the upload / fitted fallback, not Comfy.
  return !croppedInputImage || citizenImage.name !== croppedInputImage.name
}

/**
 * Image used to (re)start comfy.icu — must be the face crop, never the full upload.
 */
export function getGenerationSourceImage(
  croppedInputImage: File | undefined,
  _inputImage?: File | undefined
): File | undefined {
  return croppedInputImage
}

export type ImageResumeAction = 'resume-polling' | 'restart-generation' | 'none'

export type ImageResumeInput = {
  job: { status: 'uploading' | 'polling'; jobId?: string } | null
  jobStale: boolean
  hasAiPortraitReady: boolean
  hasSourceImage: boolean
}

/**
 * Decide how to recover an interrupted AI generation after a Privy navigation /
 * page reload.
 *
 * Key rule: a comfy.icu job that already reached the `polling` stage can be
 * resumed with ONLY its jobId — the local source image is just a fallback for
 * failures. So polling resumes even when the cropped image failed to persist.
 * Restarting an `uploading` job, by contrast, re-uploads and therefore needs the
 * cropped source image.
 *
 * Staleness (`jobStale`) only applies to `uploading` jobs, which have no jobId
 * to fall back on. A `polling` job's jobId is real and comfy.icu keeps
 * completed runs queryable for a long time (well beyond our local staleness
 * window) — so even a "stale" polling job may already have a finished
 * portrait waiting. Bug fix: this used to bail out to 'none' for any stale
 * job, which silently discarded completed AI portraits for anyone who took a
 * while to return (e.g. funding their wallet via onramp) and caused their
 * mint to fall back to the raw uploaded photo instead.
 */
export function decideImageResumeAction({
  job,
  jobStale,
  hasAiPortraitReady,
  hasSourceImage,
}: ImageResumeInput): ImageResumeAction {
  if (!job || hasAiPortraitReady) return 'none'
  if (job.status === 'polling' && job.jobId) return 'resume-polling'
  if (jobStale) return 'none'
  if (job.status === 'uploading') {
    return hasSourceImage ? 'restart-generation' : 'none'
  }
  return 'none'
}

export type ReviewPreviewInput = {
  citizenImage?: File
  croppedInputImage?: File
  inputImage?: File
  isImageGenerating: boolean
  hasPendingImageJob: boolean
  aiPortraitReady: boolean
}

/**
 * Review step preview: AI portrait when ready, else cropped placeholder while
 * generating — never the uncropped original upload.
 */
export function getReviewPreviewFile({
  citizenImage,
  croppedInputImage,
  isImageGenerating,
  hasPendingImageJob,
  aiPortraitReady,
}: ReviewPreviewInput): File | null {
  const hasAi = isUsableAiPortrait(citizenImage, croppedInputImage, aiPortraitReady)

  if (hasAi && citizenImage) {
    return citizenImage
  }

  const awaitingAi = isImageGenerating || hasPendingImageJob
  if (awaitingAi || croppedInputImage) {
    return croppedInputImage ?? null
  }

  return null
}
