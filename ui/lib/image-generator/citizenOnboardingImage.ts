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
 */
export function decideImageResumeAction({
  job,
  jobStale,
  hasAiPortraitReady,
  hasSourceImage,
}: ImageResumeInput): ImageResumeAction {
  if (!job || jobStale || hasAiPortraitReady) return 'none'
  if (job.status === 'polling' && job.jobId) return 'resume-polling'
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
  const hasAi = hasAiPortraitImage(citizenImage, croppedInputImage) && aiPortraitReady

  if (hasAi && citizenImage) {
    return citizenImage
  }

  const awaitingAi = isImageGenerating || hasPendingImageJob
  if (awaitingAi || croppedInputImage) {
    return croppedInputImage ?? null
  }

  return null
}
