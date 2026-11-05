import { expect } from 'chai'
import { walletErrorMessage } from '../../../../lib/deprize/walletError'

describe('walletErrorMessage', () => {
  const fallback = 'Could not save your prediction.'

  it('replaces the ethers network-changed dump with one sentence', () => {
    const err = {
      code: 'NETWORK_ERROR',
      message:
        'underlying network changed (event="changed", network={"name":"homestead","chainId":1}, detectedNetwork={"name":"arbitrum","chainId":42161}, code=NETWORK_ERROR, version=providers/5.7.2)',
    }
    expect(walletErrorMessage(err, fallback)).to.equal('Your wallet switched networks. Try again.')
  })

  it('says a wallet rejection was cancelled', () => {
    expect(walletErrorMessage({ code: 4001, message: 'User rejected the request.' }, fallback)).to.equal(
      'Cancelled in your wallet.'
    )
    expect(walletErrorMessage({ code: 'ACTION_REJECTED' }, fallback)).to.equal(
      'Cancelled in your wallet.'
    )
  })

  it('keeps a short readable message', () => {
    expect(walletErrorMessage({ shortMessage: 'Insufficient funds for gas.' }, fallback)).to.equal(
      'Insufficient funds for gas.'
    )
  })

  it('falls back for long, structured, or missing messages', () => {
    expect(walletErrorMessage({ message: 'x'.repeat(200) }, fallback)).to.equal(fallback)
    expect(walletErrorMessage({ message: 'failed {"data":1}' }, fallback)).to.equal(fallback)
    expect(walletErrorMessage(undefined, fallback)).to.equal(fallback)
  })
})
