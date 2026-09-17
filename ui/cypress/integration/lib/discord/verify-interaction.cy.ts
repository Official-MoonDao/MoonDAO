import { verifyDiscordRequest } from '@/lib/discord/verifyInteraction'

// Independent of discord-interactions. Generated with Node crypto:
//   node -e 'const {generateKeyPairSync,sign,createPrivateKey}=require("crypto");
//   const {privateKey,publicKey}=generateKeyPairSync("ed25519",{privateKeyEncoding:{type:"pkcs8",format:"der"},publicKeyEncoding:{type:"spki",format:"der"}});
//   const pub=publicKey.subarray(publicKey.length-32); const ts="1700000000"; const body="{\"type\":1}";
//   const sig=sign(null,Buffer.from(ts+body),createPrivateKey({key:privateKey,format:"der",type:"pkcs8"}));
//   console.log(pub.toString("hex"), sig.toString("hex"))'
// PKCS8 seed used for this committed vector:
//   302e020100300506032b6570042204200492a78c01e23781387561b12145b41b4cdb7c753c9bde85a8ec2e36fe938ed0
const PUB =
  '0789180d246b75b64535056c4edb41127d3e8842b4df964f9105e3d9f55bbb82'
const SIG =
  '6a789de5b1ff7a45af1756896ffb359473cca009dad92e8ace3aa61edf272f526fc4fe57461fbc2dffecf97fdc02b8aa9845aad0c941b71630edc3ae2d02b10e'
const TS = '1700000000'
const BODY = '{"type":1}'

describe('verifyDiscordRequest', () => {
  it('accepts the pinned independent Ed25519 vector', async () => {
    expect(
      await verifyDiscordRequest({
        publicKeyHex: PUB,
        signature: SIG,
        timestamp: TS,
        rawBody: BODY,
      })
    ).to.equal(true)
  })

  it('rejects a flipped signature byte', async () => {
    const flipped = `${SIG.slice(0, 2) === '6a' ? '6b' : '6a'}${SIG.slice(2)}`
    expect(
      await verifyDiscordRequest({
        publicKeyHex: PUB,
        signature: flipped,
        timestamp: TS,
        rawBody: BODY,
      })
    ).to.equal(false)
  })

  it('rejects an altered body', async () => {
    expect(
      await verifyDiscordRequest({
        publicKeyHex: PUB,
        signature: SIG,
        timestamp: TS,
        rawBody: '{"type":2}',
      })
    ).to.equal(false)
  })

  it('rejects an altered timestamp', async () => {
    expect(
      await verifyDiscordRequest({
        publicKeyHex: PUB,
        signature: SIG,
        timestamp: '1700000001',
        rawBody: BODY,
      })
    ).to.equal(false)
  })
})
