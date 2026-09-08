import { Redis } from '@upstash/redis'
import { NextApiRequest, NextApiResponse } from 'next'
import { secureHeaders } from 'middleware/secureHeaders'
import { enforceRegionNotRestricted } from '@/lib/geo'
import {
  COMFY_ACCELERATOR,
  COMFY_WORKFLOW_URL,
  JUGGERNAUT_CHECKPOINT_NAME,
  JUGGERNAUT_CHECKPOINT_PATH,
  JUGGERNAUT_CHECKPOINT_URL,
} from '@/lib/image-generator/comfyModels'

/**
 * Pre-warm the citizen portrait models.
 *
 * A portrait run spends most of its wall clock pulling ~10GB of weights onto a
 * cold worker rather than sampling: measured end to end at 158s cold against
 * 58s once comfy.icu's shared model cache is hot. This route submits a
 * throwaway graph that resolves the same weights, so the cache is warm by the
 * time the user has finished cropping their photo.
 *
 * Everything here is best effort. Any failure returns 200 with `warmed: false`
 * so the client never surfaces an error for an optimization.
 */

const WARM_LOCK_KEY = 'imagegen:warm:citizen'
// One warm run per window across all callers. This is a cost control, not a
// scheduler: warming more often than a worker stays hot buys nothing.
const WARM_LOCK_TTL_SECONDS = 5 * 60
const WARM_REQUEST_TIMEOUT_MS = 15_000

let redis: Redis | undefined

try {
  if (process.env.UPSTASH_REDIS_URL && process.env.UPSTASH_REDIS_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_URL,
      token: process.env.UPSTASH_REDIS_TOKEN,
    })
  }
} catch (initError) {
  console.error('Redis initialization failed (image-gen warm):', initError)
}

/**
 * Loader-only graph. Nodes 11 / 16 / 38 are deliberately left disconnected from
 * the SaveImage output: comfy.icu resolves their weights into the shared file
 * cache from the graph, and they take no image input, so they are safe whether
 * or not the executor touches them. The checkpoint path stays connected so the
 * worker also pulls the 7GB Juggernaut file, which is the single slowest asset.
 */
function buildWarmPrompt() {
  return {
    '3': {
      inputs: {
        cfg: 1,
        seed: 1,
        model: ['4', 0],
        steps: 1,
        denoise: 1,
        negative: ['40', 0],
        positive: ['39', 0],
        scheduler: 'karras',
        latent_image: ['5', 0],
        sampler_name: 'euler',
      },
      class_type: 'KSampler',
    },
    '4': {
      inputs: { ckpt_name: JUGGERNAUT_CHECKPOINT_NAME },
      class_type: 'CheckpointLoaderSimple',
    },
    '5': {
      inputs: { width: 64, height: 64, batch_size: 1 },
      class_type: 'EmptyLatentImage',
    },
    '8': {
      inputs: { vae: ['4', 2], samples: ['3', 0] },
      class_type: 'VAEDecode',
    },
    '11': {
      inputs: { instantid_file: 'instantid-ip-adapter.bin' },
      class_type: 'InstantIDModelLoader',
    },
    '16': {
      inputs: { control_net_name: 'instantid-controlnet.safetensors' },
      class_type: 'ControlNetLoader',
    },
    '38': {
      inputs: { provider: 'CPU' },
      class_type: 'InstantIDFaceAnalysis',
    },
    '39': {
      inputs: { clip: ['4', 1], text: '' },
      class_type: 'CLIPTextEncode',
    },
    '40': {
      inputs: { clip: ['4', 1], text: '' },
      class_type: 'CLIPTextEncode',
    },
    '67': {
      inputs: { images: ['8', 0], filename_prefix: 'warm' },
      class_type: 'SaveImage',
    },
  }
}

async function createWarmRun(): Promise<string | null> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), WARM_REQUEST_TIMEOUT_MS)
  try {
    const comfyRes = await fetch(COMFY_WORKFLOW_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        authorization: `Bearer ${process.env.COMFYICU_API_KEY}`,
      },
      body: JSON.stringify({
        prompt: buildWarmPrompt(),
        files: { [JUGGERNAUT_CHECKPOINT_PATH]: JUGGERNAUT_CHECKPOINT_URL },
        accelerator: COMFY_ACCELERATOR,
      }),
    })

    if (!comfyRes.ok) {
      const body = await comfyRes.text().catch(() => '')
      console.error(`Comfy.icu warm run failed: ${comfyRes.status} ${body}`)
      return null
    }

    const run = await comfyRes.json()
    return typeof run?.id === 'string' ? run.id : null
  } catch (err) {
    console.error('Comfy.icu warm run error:', err)
    return null
  } finally {
    clearTimeout(timeoutId)
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  secureHeaders(res)
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Portrait generation is not offered in restricted regions, so there is
  // nothing to warm for them either.
  if (!enforceRegionNotRestricted(req, res)) return

  if (!process.env.COMFYICU_API_KEY) {
    return res.status(200).json({ warmed: false, reason: 'not-configured' })
  }

  // Fail closed when the lock store is unavailable: an unthrottled warm-up
  // spawns billable GPU runs on every request.
  if (!redis) {
    return res.status(200).json({ warmed: false, reason: 'lock-unavailable' })
  }

  let acquired: string | null = null
  try {
    acquired = await redis.set(WARM_LOCK_KEY, Date.now(), {
      nx: true,
      ex: WARM_LOCK_TTL_SECONDS,
    })
  } catch (err) {
    console.error('Redis warm lock error (image-gen warm):', err)
    return res.status(200).json({ warmed: false, reason: 'lock-unavailable' })
  }

  if (!acquired) {
    return res.status(200).json({ warmed: false, reason: 'recently-warmed' })
  }

  const runId = await createWarmRun()

  if (!runId) {
    // Let the next caller retry rather than burning the whole lock window.
    await redis.del(WARM_LOCK_KEY).catch(() => undefined)
    return res.status(200).json({ warmed: false, reason: 'submit-failed' })
  }

  return res.status(200).json({ warmed: true, id: runId })
}
