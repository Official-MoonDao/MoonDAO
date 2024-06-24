import { BigNumber } from '@ethersproject/bignumber'
import { arrayify, hexlify } from '@ethersproject/bytes'
import { randomBytes } from '@ethersproject/random'
import { toUtf8Bytes, formatBytes32String } from '@ethersproject/strings'
import { init, encrypt } from '@shutter-network/shutter-crypto'

//import shutterWasm from '@shutter-network/shutter-crypto/dist/shutter-crypto.wasm?url'

export default async function shutterEncryptChoice(
  choice: string,
  id: string
): Promise<string | null> {
  await init('/wasm/shutter-crypto.wasm?url')

  const bytesChoice = toUtf8Bytes(choice)
  const message = arrayify(bytesChoice)
  const eonPublicKey = arrayify(
    process.env.NEXT_PUBLIC__SHUTTER_EON_PUBKEY || ''
  )

  const is32ByteString = id.substring(0, 2) === '0x'
  const proposalId = arrayify(is32ByteString ? id : formatBytes32String(id))

  const sigma = arrayify(BigNumber.from(randomBytes(32)))

  const encryptedMessage = await encrypt(
    message,
    eonPublicKey,
    proposalId,
    sigma
  )

  return hexlify(encryptedMessage) ?? null
}
