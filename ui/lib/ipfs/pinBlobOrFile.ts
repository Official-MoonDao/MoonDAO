import toast from 'react-hot-toast'
import { IPFS_GATEWAY } from '../../const/config'

interface PinResponse {
  cid: string
  url: string
}

export async function pinBlobOrFile(blob: Blob | File): Promise<PinResponse> {
  try {
    console.log('🔍 Starting pinBlobOrFile with blob:', {
      size: blob.size,
      type: blob.type,
      name: blob instanceof File ? blob.name : 'blob'
    })

    const imageFormData = new FormData()
    imageFormData.append('file', blob)

    const pin = await fetch('/api/ipfs/pin', {
      method: 'POST',
      credentials: 'include',
      body: imageFormData,
    })

    console.log('📡 API response status:', pin.status)
    
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
    console.log('✅ API response:', response)

    const { cid } = response
    if (!cid) {
      console.error('❌ No CID in response:', response)
      toast.error('No CID returned from IPFS upload', { duration: 10000 })
      return Promise.reject(new Error('No CID in response'))
    }

    const url = `${IPFS_GATEWAY}${cid}`
    console.log('🌐 Generated URL:', url)
    
    return { cid, url }
  } catch (err: any) {
    console.error('❌ pinBlobOrFile failed:', err)
    toast.error(`Error pinning file to IPFS: ${err.message}`, { duration: 10000 })
    return Promise.reject(err)
  }
}
