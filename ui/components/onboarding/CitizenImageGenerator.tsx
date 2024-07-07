// Team Image Generator
import html2canvas from 'html2canvas'
import Head from 'next/head'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { StageButton } from './StageButton'

export function ImageGenerator({
  citizenImage,
  setImage,
  nextStage,
  stage,
}: any) {
  const [userImage, setUserImage] = useState<File>()
  const [generatedImage, setGeneratedImage] = useState<string>()

  async function submitImage() {
    if (!document.getElementById('citizenPic'))
      return console.error('citizenPic is not defined')
    // @ts-expect-error
    await html2canvas(document.getElementById('citizenPic')).then((canvas) => {
      const img = canvas.toDataURL('image/png')

      //Convert from base64 to file
      const byteString = atob(img.split(',')[1])
      const mimeString = img.split(',')[0].split(':')[1].split(';')[0]
      const ab = new ArrayBuffer(byteString.length)
      const ia = new Uint8Array(ab)
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i)
      }
      const blob = new Blob([ab], { type: mimeString })
      const file = new File([blob], 'citizenPic.png', { type: mimeString })

      setImage(file)
      nextStage()
    })
  }

  async function generateImage() {
    if (!userImage) {
      return console.error('userImage is not defined')
    }
    const imageUrl = URL.createObjectURL(userImage)

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
                text: 'oil portrait of a man, dramatic lighting, Detailed, Digital painting, Artstation, Dark lighting, Concept art, Intricate,\n\n',
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
          files: { '/input/input.jpg': imageUrl },
          accelerator: 'L4',
        }),
      }
    )
      .then((res) => res.json())
      .catch((e) => console.error(e))

    console.log('jobId', jobId)
    checkJobStatus(jobId.id)
  }

  const checkJobStatus = async (jobId: string) => {
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

    const job = jobs.find((job: any) => job.id === jobId)

    if (job.status === 'COMPLETED') {
      setGeneratedImage(job.output[0].url)
    } else {
      setTimeout(() => {
        checkJobStatus(jobId)
      }, 5000)
    }
  }

  return (
    <div className="animate-fadeIn flex flex-col">
      <div className="mb-12 flex items-start md:items-center flex-col gap-4 md:flex-row">
        <input
          className="text-white text-opacity-80"
          type="file"
          accept="image/*"
          onChange={(e: any) => setUserImage(e.target.files[0])}
        />
        {userImage &&
          (citizenImage ? (
            <StageButton className="" onClick={submitImage}>
              Save Design
            </StageButton>
          ) : (
            <StageButton onClick={generateImage}>generate</StageButton>
          ))}
      </div>
      <div
        id="citizenPic"
        className="w-[90vw] rounded-[5vmax] rounded-tl-[20px] h-[90vw] md:w-[600px] md:h-[600px] bg-white bg-cover justify-left relative flex"
      >
        {/* <div
          id="user-image"
          style={{
            backgroundImage: `url(${
              userImage
                ? URL.createObjectURL(userImage)
                : '/assets/image-placeholder.svg'
            })`,
          }}
          className="h-[48%] w-[75%] mt-[29%] ml-[15%] bg-contain bg-no-repeat bg-center mix-blend-multiply"
        ></div> */}

        {userImage && (
          <Image
            src={URL.createObjectURL(userImage)}
            layout="fill"
            objectFit="contain"
            className="mix-blend-multiply"
            alt={''}
          />
        )}
      </div>
    </div>
  )
}
