import { BEACONCHAIN_API_BASE } from 'const/config'

interface ValidatorPerformance {
  validatorindex: number
  balance: number
  performance1d: number
  performance7d: number
  performance31d: number
  performance365d: number
  rank7d: number
}

export async function getValidatorIndicesFromPubKeys(
  pubKeys: string[]
): Promise<number[]> {
  try {
    if (pubKeys.length === 0) return []

    // Convert pubkeys to the format expected by beaconcha.in (remove 0x prefix)
    const cleanPubKeys = pubKeys.map((pk) => pk.replace('0x', ''))

    // Beaconcha.in API supports batch requests with comma-separated pubkeys
    const pubKeyString = cleanPubKeys.join(',')

    const response = await fetch(
      `${BEACONCHAIN_API_BASE}/validator/${pubKeyString}`
    )

    if (!response.ok) {
      throw new Error(`Beaconchain API error: ${response.status}`)
    }

    const data = await response.json()

    if (data.status !== 'OK') {
      throw new Error(`Beaconchain API status: ${data.status}`)
    }

    // Handle both single validator and multiple validators response
    const validators = Array.isArray(data.data) ? data.data : [data.data]

    return validators
      .filter((v: any) => v && typeof v.validatorindex === 'number')
      .map((v: any) => v.validatorindex)
  } catch (error) {
    console.error('Failed to get validator indices:', error)
    return []
  }
}

export async function getValidatorPerformance(
  validatorIndices: number[]
): Promise<ValidatorPerformance[]> {
  try {
    if (validatorIndices.length === 0) return []

    // Batch request for validator performance
    const indexString = validatorIndices.join(',')

    const response = await fetch(
      `${BEACONCHAIN_API_BASE}/validator/${indexString}/performance`
    )

    if (!response.ok) {
      throw new Error(`Beaconchain API error: ${response.status}`)
    }

    const data = await response.json()

    if (data.status !== 'OK') {
      throw new Error(`Beaconchain API status: ${data.status}`)
    }

    // Handle both single validator and multiple validators response
    return Array.isArray(data.data) ? data.data : [data.data]
  } catch (error) {
    console.error('Failed to get validator performance:', error)
    return []
  }
}
