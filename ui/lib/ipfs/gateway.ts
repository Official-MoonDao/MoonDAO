import { IPFS_GATEWAY } from 'const/config'

export function getIPFSGateway(ipfsString: string) {
  if (!ipfsString) return ''
  let hash = ipfsString.startsWith('ipfs://')
    ? ipfsString.split('ipfs://')[1]
    : ipfsString.startsWith('https://')
    ? ipfsString.split('/ipfs/')[1]
    : ipfsString
  return `${IPFS_GATEWAY}${hash}`
}
