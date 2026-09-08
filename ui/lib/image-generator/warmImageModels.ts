export const WARM_IMAGE_MODELS_SESSION_KEY = 'CreateCitizen_warmedImageModels'

/**
 * Ask the server to pre-load the portrait models while the user is still
 * picking and cropping a photo. A cold comfy.icu worker spends most of a run
 * pulling ~10GB of weights, so paying that cost during the time the user is
 * already spending in the cropper is worth roughly a minute on the first run.
 *
 * Strictly best effort: it never throws, never blocks rendering, and a failure
 * just means the first real generation pays the cold-start cost as before. The
 * server applies its own global throttle, so extra calls here are harmless.
 */
export async function warmImageModels(): Promise<void> {
  if (typeof window === 'undefined') return

  try {
    if (sessionStorage.getItem(WARM_IMAGE_MODELS_SESSION_KEY)) return
    sessionStorage.setItem(WARM_IMAGE_MODELS_SESSION_KEY, '1')
  } catch {
    // sessionStorage can be unavailable (private mode / blocked storage). Warm
    // anyway; the server-side lock is what actually bounds the cost.
  }

  try {
    await fetch('/api/image-gen/warm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    /* ignore */
  }
}
