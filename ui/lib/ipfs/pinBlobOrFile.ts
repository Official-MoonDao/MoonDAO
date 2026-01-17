import toast from 'react-hot-toast'
import { IPFS_GATEWAY } from '../../const/config'

interface PinResponse {
  cid: string
  url: string
}

export async function pinBlobOrFile(blob: Blob | File, pinUrl: string): Promise<PinResponse> {
  try {
    const imageFormData = new FormData()
    imageFormData.append('file', blob)

    const pin = await fetch(pinUrl || '/api/ipfs/pin', {
      method: 'POST',
      credentials: 'include',
      body: imageFormData,
    })

    if (pin.status === 401) {
      console.error('❌ Authentication failed (401)')
      toast.error('Authentication failed. Please try logging in again.', { duration: 10000 })
      return { cid: '', url: '' }
    }

    if (!pin.ok) {
      const errorText = await pin.text()
      console.error('❌ API error:', pin.status, errorText)
      toast.error(`Upload failed: ${pin.status} ${errorText}`, { duration: 10000 })
      return Promise.reject(new Error(`HTTP ${pin.status}: ${errorText}`))
    }

    const response = await pin.json()

    const { cid } = response
    if (!cid) {
      console.error('❌ No CID in response:', response)
      toast.error('No CID returned from IPFS upload', { duration: 10000 })
      return Promise.reject(new Error('No CID in response'))
    }

    const url = `${IPFS_GATEWAY}${cid}`

    return { cid, url }
  } catch (err: any) {
    console.error('❌ pinBlobOrFile failed:', err)
    toast.error(`Error pinning file to IPFS: ${err.message}`, { duration: 10000 })
    return Promise.reject(err)
  }
}
