import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { v4 } from 'uuid'
import { authOptions } from '../auth/[...nextauth]'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'POST') {
    const session = await getServerSession(req, res, authOptions)

    if (!session) {
      return res.status(401).json('Unauthorized')
    }

    const { url } = req.body
    const uuid = v4()
    const files: { [key: string]: string } = {}
    files[`/input/${uuid}.jpg`] = url

    // generate a random 15 digit number
    let seed = ''
    for (let i = 0; i < 15; i++) {
      seed += Math.floor(Math.random() * 10)
    }
    const jobId = await fetch(
      'https://comfy.icu/api/v1/workflows/8BYQ3mpiFVlTjWOatIUAc/runs',
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
                text: "Create a portrait of an Astronaut wearing a futuristic space suit in the style of Jorodowsky's Dune with the face prominently displayed up to the beginning of the shoulders with a watercolor psychedelic background displaying the moon, stars, and other space elements. Overall make the person look like a badass and make them look as good as possible, something they would be proud to share on social media. Don't put any space element on their face or forehead. High-quality. Portrait mode.",
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
          accelerator: 'A100',
        }),
      }
    )
      .then(async (res) => await res.json())
      .catch((e) => console.error(e))
    return res.send(jobId)
  } else if (req.method === 'GET') {
    const jobs = await fetch(
      'https://comfy.icu/api/v1/workflows/8BYQ3mpiFVlTjWOatIUAc/runs',
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
