import { NFT } from 'thirdweb'

export type NetworkTab = 'citizens' | 'teams' | 'map'

export type NetworkNFT = NFT & {
  metadata: {
    id: string | number
    name: string
    description: string
    image: string
    attributes?: any[]
  }
}

export type CitizenLocationData = {
  id: string | number
  name: string
  location: string
  formattedAddress: string
  image: string
  lat: number
  lng: number
}

export type GroupedLocationData = {
  citizens: CitizenLocationData[]
  names: string[]
  formattedAddress: string
  lat: number
  lng: number
  color: string
  size: number
}

export type UseNetworkDataOptions = {
  page?: number
  pageSize?: number
  search?: string
  enabled?: boolean
  initialData?: any[]
}

export type NetworkDataResult<T> = {
  data: T[]
  isLoading: boolean
  error: Error | null
  totalCount: number
  maxPage: number
}


