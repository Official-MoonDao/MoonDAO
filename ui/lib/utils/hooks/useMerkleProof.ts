import { useAddress } from '@thirdweb-dev/react'
import { MerkleTree } from 'merkletreejs'
import { useEffect, useState } from 'react'
import { keccak256 } from 'ethers/lib/utils'
import { bufferToHex } from '../strings'

export function useMerkleProof(whitelist: string[] | undefined) {
  const address = useAddress()
  const [merkleProof, setMerkleProof] = useState<any>()

  function generateMerkleProof() {
    if (!whitelist?.[0] || !address) return
    const cleanAddresses = whitelist
      .filter((address) => address !== '')
      .map((a) => a.trim())

    const leaves = cleanAddresses.map((x) => keccak256(x))
    const tree = new MerkleTree(leaves, keccak256, { sortPairs: true })

    const leaf = keccak256(address)
    const proof = tree.getProof(leaf).map((x) => bufferToHex(x.data))
    setMerkleProof(proof)
  }

  useEffect(() => {
    generateMerkleProof()
  }, [address])

  return merkleProof
}
