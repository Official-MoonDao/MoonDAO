import { NextApiRequest, NextApiResponse } from 'next'
import { v4 } from 'uuid'

const COMFY_WORKFLOW_URL =
  'https://comfy.icu/api/v1/workflows/8BYQ3mpiFVlTjWOatIUAc/runs'

// Comfy.icu's API can occasionally take a while to accept a job, so give it
// plenty of time before we abort the request.
const COMFY_REQUEST_TIMEOUT_MS = 45_000

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
                cfg: 2.6,
                seed: Number(seed),
                model: ['60', 0],
                steps: 7,
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
              inputs: { ckpt_name: 'albedobaseXL_v21.safetensors' },
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
                text: "Create a portrait of an Astronaut wearing a futuristic space suit in the style of Jorodowsky's Dune with the face prominently displayed up to the beginning of the shoulders with a watercolor psychedelic background displaying the moon, stars, and other space elements. Overall make the person look like a badass and make them look as good as possible, something they would be proud to share on social media. Don't put any space element on their face or forehead. High-quality. Portrait mode.\n\n",
              },
              class_type: 'CLIPTextEncode',
            },
            '40': {
              inputs: { clip: ['4', 1], text: 'watermark, text, monochrome' },
              class_type: 'CLIPTextEncode',
            },
            '60': {
              inputs: {
                image: ['13', 0],
                model: ['4', 0],
                end_at: 1,
                weight: 0.8,
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
          accelerator: 'L4',
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
