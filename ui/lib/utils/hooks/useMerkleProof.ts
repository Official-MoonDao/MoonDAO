import { useAddress } from '@thirdweb-dev/react'
import { ethers } from 'ethers'
import { MerkleTree } from 'merkletreejs'
import { useEffect, useState } from 'react'
import { keccak256 } from 'ethers/lib/utils'

const bufferToHex = (x: any) => `0x${x.toString('hex')}`

export function useMerkleProof(whitelist: string[] | undefined) {
  const address = useAddress()
  const [merkleProof, setMerkleProof] = useState<any>()

  function generateMerkleProof() {
    if (!whitelist?.[0] || !address) return
    const cleanAddresses = whitelist
      .filter((address) => address !== '')
      .map((a) => a.trim())
    cleanAddresses.push(address)

    const leaves = cleanAddresses.map((x) => keccak256(x))
    const tree = new MerkleTree(leaves, keccak256, { sortPairs: true })

    const leaf = keccak256(address)
    const proof = tree.getProof(leaf).map((x) => bufferToHex(x.data))
    setMerkleProof(proof)
    console.log(proof)
  }

  useEffect(() => {
    generateMerkleProof()
  }, [address])

  return merkleProof
}
