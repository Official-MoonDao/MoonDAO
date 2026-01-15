import { NFT } from 'thirdweb'

export type TeamRow = {
  id: number
  name: string
  description: string
  image: string
  website: string
  communications: string
  view: string
  formId: string
}

export type CitizenRow = {
  id: number
  name: string
  description: string
  image: string
  location: any
  website: string
  discord: string
  twitter: string
  instagram: string
  linkedin: string
  view: string
  formId: string
  owner: string
}

export function teamRowToNFT(row: TeamRow | Record<string, unknown>) {
  const {
    id,
    name,
    description,
    image,
    website,
    communications,
    view,
    formId,
  } = row

  const nft = {
    id,
    metadata: {
      id: id || '',
      uri: '',
      name: name || '',
      description: description || '',
      image: image || '',
      animation_url: '',
      external_url: '',
      attributes: [
        { trait_type: 'website', value: website || '' },
        { trait_type: 'communications', value: communications || '' },
        { trait_type: 'view', value: view || '' },
        { trait_type: 'formId', value: formId || '' },
      ] as unknown as Record<string, unknown>,
    },
    owner: '',
    tokenURI: '',
    type: 'ERC721',
  } as any

  return nft
}

export function citizenRowToNFT(row: CitizenRow | Record<string, unknown>) {
  const {
    id,
    name,
    description,
    image,
    location,
    website,
    discord,
    twitter,
    instagram,
    linkedin,
    view,
    formId,
    owner,
  } = row

  const locationValue = JSON.stringify(location)

  const nft = {
    id,
    metadata: {
      id: id || '',
      uri: '',
      name: name || '',
      description: description || '',
      image: image || '',
      animation_url: '',
      external_url: '',
      attributes: [
        {
          trait_type: 'location',
          value: locationValue || '',
        },
        { trait_type: 'website', value: website || '' },
        { trait_type: 'discord', value: discord || '' },
        { trait_type: 'twitter', value: twitter || '' },
        { trait_type: 'instagram', value: instagram || '' },
        { trait_type: 'linkedin', value: linkedin || '' },
        { trait_type: 'view', value: view || '' },
        { trait_type: 'formId', value: formId || '' },
      ] as unknown as Record<string, unknown>,
    },
    owner: owner || '',
    tokenURI: '',
    type: 'ERC721',
  } as any

  return nft
}
