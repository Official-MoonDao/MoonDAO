import { useAddress } from '@thirdweb-dev/react'
import { ethers } from 'ethers'
import { MerkleTree } from 'merkletreejs'
import { useEffect, useState } from 'react'
import { keccak256 } from 'ethers/lib/utils'

export function useMerkleProof(whitelist: string[]) {
  const address = useAddress()
  const [merkleProof, setMerkleProof] = useState<any>()

  useEffect(() => {
    if (address && whitelist[0]) {
      const { keccak256 } = ethers.utils
      const leaves = whitelist.map((address) => keccak256(address))
      const tree = new MerkleTree(leaves, keccak256, { sort: true })

      setMerkleProof(tree.getHexProof(keccak256(address)))
    }
  }, [whitelist])

  return merkleProof
}
