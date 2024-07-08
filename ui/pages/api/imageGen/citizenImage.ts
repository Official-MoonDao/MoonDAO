import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log(process.env.COMFYICU_API_KEY)
  if (req.method === 'POST') {
    const { url } = req.body
    const jobId = await fetch(
      'https://comfy.icu/api/v1/workflows/72hy4zetA-0OBLesxmjJc/runs',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          authorization: `Bearer ${process.env.COMFYICU_API_KEY}`,
        },
        body: JSON.stringify({
          prompt: {
            '3': {
              inputs: {
                cfg: 2.6,
                seed: 963816335811821,
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
              inputs: { image: 'input.jpg', upload: 'image' },
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
                text: 'a portrait of an astronaut on the moon in watercolor style with rainbow background\n\n',
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
          files: { '/input/input.jpg': url },
          accelerator: 'L4',
        }),
      }
    )
      .then(async (res) => await res.json())
      .catch((e) => console.error(e))
    return res.send(jobId)
  } else if (req.method === 'GET') {
    const jobs = await fetch(
      'https://comfy.icu/api/v1/workflows/72hy4zetA-0OBLesxmjJc/runs',
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          authorization: `Bearer ${process.env.COMFYICU_API_KEY}`,
        },
      }
    ).then((res) => res.json())
    return res.send(jobs)
  } else {
    return res.status(400)
  }
}
