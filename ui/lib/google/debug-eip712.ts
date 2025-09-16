// debug-eip712.ts
import { config } from 'dotenv'
import { utils } from 'ethers'
import { getHSMSigner } from './hsm-signer'

config({ path: ['.env.local', '.env'] })

// Use the actual values from your failing request
const domain = {
  name: 'MoonDAO XP Oracle',
  version: '1.0.0',
  chainId: 11155111,
  verifyingContract: '0x1b170AeAa10cF10d788444628490c9d96Ce1dA13',
}

const types = {
  Proof: [
    { name: 'user', type: 'address' },
    { name: 'verifier', type: 'address' },
    { name: 'contextHash', type: 'bytes32' },
    { name: 'xpAmount', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
  ],
}

// Use a test proof with real addresses
const proof = {
  user: '0x1234567890123456789012345678901234567890',
  verifier: '0x1234567890123456789012345678901234567890',
  contextHash:
    '0x0000000000000000000000000000000000000000000000000000000000000000',
  xpAmount: '1000000000000000000',
  validAfter: '0',
  validBefore: '0',
}

async function testHSMSigning() {
  console.log('Testing HSM signing with EIP-712...\n')

  // Create the EIP-712 hash manually
  const messageHash = utils._TypedDataEncoder.hash(domain, types, proof)
  console.log('Manual EIP-712 message hash:', messageHash)

  // Test with HSM signer
  try {
    const hsmSigner = getHSMSigner()
    const result = await hsmSigner.signTypedData(domain, types, proof)

    console.log('HSM signature:', result.signature)
    console.log('HSM claims address:', result.address)

    // Test recovery
    const recoveredAddress = utils.recoverAddress(messageHash, result.signature)
    console.log('Recovered address:', recoveredAddress)
    console.log(
      'Addresses match:',
      recoveredAddress.toLowerCase() === result.address.toLowerCase()
    )

    // Test with the failing signature from before
    const failingSignature =
      '0x88f45d168534f0dffd6671131e920695771d46a496c61fc046e8150a7fd656ed5538374890a49d0d0f56e5749f3abb2ed0d08d46f6cb6bedfa76c13e0d4878171b'
    const failingRecovered = utils.recoverAddress(messageHash, failingSignature)
    console.log('Failing signature recovers to:', failingRecovered)
  } catch (error) {
    console.error('HSM signing failed:', error)
  }
}

testHSMSigning()
