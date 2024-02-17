import Safe, {
  EthersAdapter,
  SafeFactory,
  SafeAccountConfig,
} from '@safe-global/protocol-kit'
import { ethers } from 'ethers'

export async function createSafe(
  signer: any,
  owners: string[],
  threshold: number
) {
  const ethAdapter: any = new EthersAdapter({
    ethers,
    signerOrProvider: signer,
  })

  const safeFactory = await SafeFactory.create({ ethAdapter })

  const safeAccountConfig: SafeAccountConfig = {
    owners,
    threshold,
  }

  const safeSDK = await safeFactory.deploySafe({ safeAccountConfig })
  console.log(safeSDK)
  return safeSDK
}
