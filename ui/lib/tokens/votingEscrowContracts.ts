import { getContract } from 'thirdweb'
import { arbitrum, base, ethereum, polygon } from '@/lib/rpc/chains'
import client from '@/lib/thirdweb/client'
import VotingEscrow from '../../const/abis/VotingEscrow.json'
import { VMOONEY_ADDRESSES } from '../../const/config'

const chainConfigs = [
  { key: 'ethereum', chain: ethereum },
  { key: 'polygon', chain: polygon },
  { key: 'arbitrum', chain: arbitrum },
  { key: 'base', chain: base },
]

export const votingEscrowContracts = chainConfigs.reduce<Record<string, any>>(
  (acc, { key, chain }) => {
    const address = VMOONEY_ADDRESSES[key]
    if (!address) {
      return acc
    }

    acc[key] = getContract({
      client,
      address,
      chain,
      abi: VotingEscrow as any,
    })

    return acc
  },
  {}
)
