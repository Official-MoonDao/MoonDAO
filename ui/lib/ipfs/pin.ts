import toast from 'react-hot-toast'

export async function pinImageToIPFS(
  JWT: string,
  image: File,
  ipfsLabel: string
) {
  try {
    const imageFormData: any = new FormData()

    imageFormData.append('pinataMetadata', JSON.stringify({ name: ipfsLabel }))
    imageFormData.append('pinataOptions', JSON.stringify({ cidVersion: 0 }))
    imageFormData.append('file', image)

    const imageRes = await fetch(
      'https://api.pinata.cloud/pinning/pinFileToIPFS',
      {
        method: 'POST',
        body: imageFormData,
        headers: {
          Authorization: `Bearer ${JWT}`,
        },
      }
    )

    const { IpfsHash } = await imageRes.json()

    return IpfsHash
  } catch (err) {
    console.log(err)
  }
}

export async function pinMetadataToIPFS(
  JWT: string,
  metadata: any,
  ipfsLabel: string
) {
  try {
    const metadataFormData: any = new FormData()

    metadataFormData.append(
      'pinataMetadata',
      JSON.stringify({ name: ipfsLabel })
    )
    metadataFormData.append('pinataOptions', JSON.stringify({ cidVersion: 0 }))
    metadataFormData.append(
      'file',
      new Blob([JSON.stringify(metadata)], {
        type: 'application/json',
      })
    )
    const metadataRes = await fetch(
      'https://api.pinata.cloud/pinning/pinJSONToIPFS',
      {
        method: 'POST',
        body: metadataFormData,
        headers: {
          Authorization: `Bearer ${JWT}`,
        },
      }
    )

    const { IpfsHash } = await metadataRes.json()

    return IpfsHash
  } catch (err: any) {
    console.log(err)
  }
}
