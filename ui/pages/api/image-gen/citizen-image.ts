import { NextApiRequest, NextApiResponse } from 'next'
import { v4 } from 'uuid'

const COMFY_WORKFLOW_URL =
  'https://comfy.icu/api/v1/workflows/8BYQ3mpiFVlTjWOatIUAc/runs'

// Comfy.icu's API can occasionally take a while to accept a job, so give it
// plenty of time before we abort the request.
const COMFY_REQUEST_TIMEOUT_MS = 45_000

// The comfy.icu API workers don't have the Juggernaut Lightning checkpoint
// pre-installed, so we supply it via the `files` map. The worker downloads it on
// first use and caches it for subsequent runs. Public, ungated HF repo (no token
// required); the destination filename below must match node 4's `ckpt_name`.
const JUGGERNAUT_CHECKPOINT_PATH =
  '/models/checkpoints/juggernautXL_v9Rdphoto2Lighting.safetensors'
const JUGGERNAUT_CHECKPOINT_URL =
  'https://huggingface.co/RunDiffusion/Juggernaut-XL-Lightning/resolve/main/Juggernaut_RunDiffusionPhoto2_Lightning_4Steps.safetensors?download=true'

async function fetchComfy(
  init: RequestInit & { method: 'POST' | 'GET' }
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(
    () => controller.abort(),
    COMFY_REQUEST_TIMEOUT_MS
  )
  try {
    return await fetch(COMFY_WORKFLOW_URL, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        authorization: `Bearer ${process.env.COMFYICU_API_KEY}`,
        ...(init.headers || {}),
      },
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!process.env.COMFYICU_API_KEY) {
    console.error('COMFYICU_API_KEY is not configured')
    return res.status(500).json({ error: 'Image generation is not configured' })
  }

  if (req.method === 'POST') {
    const { url } = req.body || {}
    if (typeof url !== 'string' || !url) {
      return res.status(400).json({ error: 'Missing url' })
    }
    const uuid = v4()
    const files: { [key: string]: string } = {}
    files[`/input/${uuid}.jpg`] = url
    files[JUGGERNAUT_CHECKPOINT_PATH] = JUGGERNAUT_CHECKPOINT_URL

    // generate a random 15 digit number
    let seed = ''
    for (let i = 0; i < 15; i++) {
      seed += Math.floor(Math.random() * 10)
    }
    try {
      const comfyRes = await fetchComfy({
        method: 'POST',
        body: JSON.stringify({
          prompt: {
            '3': {
              inputs: {
                cfg: 2.3,
                seed: Number(seed),
                model: ['60', 0],
                steps: 5,
                denoise: 1,
                negative: ['60', 2],
                positive: ['60', 1],
                scheduler: 'karras',
                latent_image: ['5', 0],
                sampler_name: 'dpmpp_sde',
              },
              class_type: 'KSampler',
            },
            '4': {
              inputs: { ckpt_name: 'juggernautXL_v9Rdphoto2Lighting.safetensors' },
              class_type: 'CheckpointLoaderSimple',
            },
            '5': {
              inputs: { width: 1024, height: 1024, batch_size: 1 },
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
            '13': {
              inputs: { image: `${uuid}.jpg`, upload: 'image' },
              class_type: 'LoadImage',
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
              inputs: {
                clip: ['4', 1],
                text: "Head-and-shoulders portrait tightly cropped at the upper chest, face and shoulders filling the frame, only head and shoulders visible, no torso below chest, youthful person with smooth clear skin, bright clear eyes, full hair, ears visible, confident determined gaze, heroic presence, wearing thick futuristic sweater with high collar and long sleeves completely covering chest and body, heavy fabric futuristic clothing, fully dressed in opaque layered clothing, detailed sweater texture, no skin exposed below neck, painterly style of Jodorowsky's Dune, surreal watercolor psychedelic cosmic background with stars nebulae planets spaceships, clean cinematic lighting, flattering soft key light, vivid colors, sharp focus, best flattering youthful version, correct eye color, only one person",
              },
              class_type: 'CLIPTextEncode',
            },
            '40': {
              inputs: {
                clip: ['4', 1],
                text: '(watermark:1.9), (signature:1.5), text, logo, (wrinkles:1.6), (eye bags:1.5), (aged skin:1.5), old, elderly, beard, facial hair, (ear muffs:1.8), (headphones:1.7), helmet, space helmet, glasses, hat, hood, (full body:1.6), (wide shot:1.5), legs, torso, standing, (nipples:2.3), (erect nipples:2.4), (boobs:2.4), (breasts:2.4), (cleavage:2.3), (underboob:2.3), (exposed breasts:2.5), (naked:2.5), (nude:2.5), (topless:2.5), (bare chest:2.4), (exposed skin on chest:2.3), (see-through clothing:2.2), (wet clothing:2.1), (sheer fabric:2.1), (revealing outfit:2.2), pornography, explicit, erotic, sensual pose, suggestive, (blouse:2.0), (low cut:2.1)',
              },
              class_type: 'CLIPTextEncode',
            },
            '60': {
              inputs: {
                image: ['13', 0],
                model: ['4', 0],
                end_at: 1,
                weight: 0.85,
                negative: ['40', 0],
                positive: ['39', 0],
                start_at: 0,
                instantid: ['11', 0],
                control_net: ['16', 0],
                insightface: ['38', 0],
              },
              class_type: 'ApplyInstantID',
            },
            '67': {
              inputs: { images: ['8', 0], filename_prefix: 'ComfyUI' },
              class_type: 'SaveImage',
            },
          },
          files,
          accelerator: 'L40S',
        }),
      })

      if (!comfyRes.ok) {
        const body = await comfyRes.text().catch(() => '')
        console.error(
          `Comfy.icu run create failed: ${comfyRes.status} ${body}`
        )
        return res
          .status(comfyRes.status >= 500 ? 502 : comfyRes.status)
          .json({ error: 'Failed to create comfy.icu job' })
      }

      const jobId = await comfyRes.json()
      return res.status(200).json(jobId)
    } catch (err: any) {
      const isAbort = err?.name === 'AbortError'
      console.error('Comfy.icu run create error:', err)
      return res
        .status(isAbort ? 504 : 502)
        .json({ error: 'Failed to create comfy.icu job' })
    }
  } else if (req.method === 'GET') {
    try {
      const comfyRes = await fetchComfy({ method: 'GET' })
      if (!comfyRes.ok) {
        const body = await comfyRes.text().catch(() => '')
        console.error(
          `Comfy.icu list runs failed: ${comfyRes.status} ${body}`
        )
        return res
          .status(comfyRes.status >= 500 ? 502 : comfyRes.status)
          .json({ error: 'Failed to fetch comfy.icu jobs' })
      }
      const jobs = await comfyRes.json()
      return res.status(200).json(jobs)
    } catch (err: any) {
      const isAbort = err?.name === 'AbortError'
      console.error('Comfy.icu list runs error:', err)
      return res
        .status(isAbort ? 504 : 502)
        .json({ error: 'Failed to fetch comfy.icu jobs' })
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' })
  }
}
