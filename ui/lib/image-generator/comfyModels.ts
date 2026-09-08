/**
 * Shared description of the comfy.icu workflow behind citizen portraits.
 *
 * comfy.icu resolves the InstantID / insightface weights itself from the node
 * graph, but the Juggernaut Lightning checkpoint is not present on the API
 * workers, so we hand it over through the `files` map and the worker caches it
 * for subsequent runs. The pre-warm route relies on that same resolution, so
 * these values have to stay in sync across both routes.
 */
export const COMFY_WORKFLOW_ID = '8BYQ3mpiFVlTjWOatIUAc'
export const COMFY_WORKFLOW_URL = `https://comfy.icu/api/v1/workflows/${COMFY_WORKFLOW_ID}/runs`

export const COMFY_ACCELERATOR = 'L40S'

// Comfy.icu's API can occasionally take a while to accept a job, so give it
// plenty of time before we abort the request.
export const COMFY_REQUEST_TIMEOUT_MS = 45_000

export const JUGGERNAUT_CHECKPOINT_NAME = 'juggernautXL_v9Rdphoto2Lighting.safetensors'
export const JUGGERNAUT_CHECKPOINT_PATH = `/models/checkpoints/${JUGGERNAUT_CHECKPOINT_NAME}`
export const JUGGERNAUT_CHECKPOINT_URL =
  'https://huggingface.co/RunDiffusion/Juggernaut-XL-Lightning/resolve/main/Juggernaut_RunDiffusionPhoto2_Lightning_4Steps.safetensors?download=true'
