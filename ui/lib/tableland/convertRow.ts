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
  location: string
  website: string
  discord: string
  twitter: string
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
      id,
      uri: '',
      name,
      description,
      image,
      animation_url: '',
      external_url: '',
      attributes: [
        { trait_type: 'website', value: website },
        { trait_type: 'communications', value: communications },
        { trait_type: 'view', value: view },
        { trait_type: 'formId', value: formId },
      ] as unknown as Record<string, unknown>,
    },
    owner: null,
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
    view,
    formId,
    owner,
  } = row

  const nft = {
    id,
    metadata: {
      id,
      uri: '',
      name,
      description,
      image,
      animation_url: '',
      external_url: '',
      attributes: [
        { trait_type: 'location', value: location },
        { trait_type: 'website', value: website },
        { trait_type: 'discord', value: discord },
        { trait_type: 'twitter', value: twitter },
        { trait_type: 'view', value: view },
        { trait_type: 'formId', value: formId },
      ] as unknown as Record<string, unknown>,
    },
    owner,
    tokenURI: '',
    type: 'ERC721',
  } as any

  return nft
}
