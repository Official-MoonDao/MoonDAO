import { buildSafeTxServiceUrl, serializeSafeProxyBody } from '@/lib/safe/txServiceProxy'

const SAFE = '0xAbC0000000000000000000000000000000000001'

describe('buildSafeTxServiceUrl', () => {
  it('maps the chain ID to the tx-service short name with a trailing slash', () => {
    expect(buildSafeTxServiceUrl('42161', ['v1', 'safes', SAFE, 'balances'])).to.deep.equal({
      url: `https://api.safe.global/tx-service/arb1/api/v1/safes/${SAFE}/balances/`,
    })
  })

  it('forwards the query string', () => {
    expect(
      buildSafeTxServiceUrl('1', ['v2', 'safes', SAFE, 'balances'], '/api/safe/1/v2?trusted=true'),
    ).to.deep.equal({
      url: `https://api.safe.global/tx-service/eth/api/v2/safes/${SAFE}/balances/?trusted=true`,
    })
  })

  it('rejects unsupported chains', () => {
    expect(buildSafeTxServiceUrl('999', ['v1', 'safes'])).to.deep.equal({
      error: 'Unsupported chain ID: 999',
    })
  })

  it('rejects paths without a v1/v2 prefix or with unsafe segments', () => {
    expect(buildSafeTxServiceUrl('1', ['v3', 'safes'])).to.deep.equal({ error: 'Invalid path' })
    expect(buildSafeTxServiceUrl('1', ['v1', '..'])).to.deep.equal({ error: 'Invalid path' })
    expect(buildSafeTxServiceUrl('1', undefined)).to.deep.equal({ error: 'Invalid path' })
  })
})

describe('serializeSafeProxyBody', () => {
  it('omits the body for GET and empty bodies', () => {
    expect(serializeSafeProxyBody('GET', { a: 1 })).to.equal(undefined)
    expect(serializeSafeProxyBody('POST', undefined)).to.equal(undefined)
    expect(serializeSafeProxyBody('POST', '')).to.equal(undefined)
  })

  it('JSON-encodes objects and passes strings through', () => {
    expect(serializeSafeProxyBody('POST', { a: 1 })).to.equal('{"a":1}')
    expect(serializeSafeProxyBody('DELETE', '{"b":2}')).to.equal('{"b":2}')
  })
})
