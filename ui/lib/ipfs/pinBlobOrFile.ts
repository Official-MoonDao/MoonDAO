import { getAccessToken } from "@privy-io/react-auth";
import toast from "react-hot-toast";

interface PinResponse {
  cid: string
  url: string
}

const IPFS_GATEWAY = process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? 'https://gray-main-toad-36.mypinata.cloud' : 'https://tan-collective-smelt-690.mypinata.cloud'

export async function pinBlobOrFile (blob: Blob | File): Promise<PinResponse> {
  try {
    const imageFormData = new FormData()
    imageFormData.append('file', blob)

    const accessToken = await getAccessToken()
    const pin = await fetch('/api/ipfs/pin', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      body: imageFormData
    })
    if (pin.status === 401) {
      toast.error('Sign in add images to proposal')
      return { cid: '', url: ''}
    }
    const { cid } = await pin.json();
    const url = `${IPFS_GATEWAY}/ipfs/${cid}`
    return { cid, url }
  } catch (e) {
    toast.error(`Error pinning file to IPFS`)
    return Promise.reject(e)
  }
}
