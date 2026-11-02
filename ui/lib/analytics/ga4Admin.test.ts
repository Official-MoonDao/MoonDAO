/// <reference types="node" />
/// <reference types="mocha" />
import assert from 'assert'
import { ENTRY_PATH_DIMENSION, ensureEntryPathDimension } from './ga4Admin'

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}

describe('entry_path dimension', () => {
  it('creates the event dimension when it is missing', async () => {
    const calls: { url: string; init?: RequestInit }[] = []
    const result = await ensureEntryPathDimension({
      propertyId: '123456',
      accessToken: 'test-token',
      fetchImpl: async (url, init) => {
        calls.push({ url, init })
        if (calls.length === 1) return jsonResponse(200, { customDimensions: [] })
        return jsonResponse(200, { name: 'properties/123456/customDimensions/1' })
      },
    })
    assert.deepStrictEqual(result, {
      created: true,
      name: 'properties/123456/customDimensions/1',
    })
    assert.strictEqual(calls.length, 2)
    assert.equal(calls[0].url.includes('/properties/123456/customDimensions'), true)
    assert.strictEqual(calls[1].init?.method, 'POST')
    assert.deepStrictEqual(JSON.parse(String(calls[1].init?.body)), ENTRY_PATH_DIMENSION)
    const headers = calls[1].init?.headers as { Authorization?: string }
    assert.equal(headers.Authorization?.includes('test-token'), true)
    assert.equal(JSON.stringify(calls).includes('private_key'), false)
  })

  it('does not create a dimension that is already event scoped', async () => {
    let lists = 0
    const result = await ensureEntryPathDimension({
      propertyId: '123456',
      accessToken: 'test-token',
      fetchImpl: async (url, init) => {
        assert.notStrictEqual(init?.method, 'POST')
        lists += 1
        if (url.includes('pageToken=next')) {
          return jsonResponse(200, {
            customDimensions: [
              {
                parameterName: 'entry_path',
                scope: 'USER',
                name: 'properties/123456/customDimensions/9',
              },
              {
                parameterName: 'entry_path',
                scope: 'EVENT',
                name: 'properties/123456/customDimensions/3',
              },
            ],
          })
        }
        return jsonResponse(200, { customDimensions: [], nextPageToken: 'next' })
      },
    })
    assert.deepStrictEqual(result, {
      created: false,
      name: 'properties/123456/customDimensions/3',
    })
    assert.strictEqual(lists, 2)
  })

  it('rejects a measurement id in place of the numeric property id', async () => {
    await assert.rejects(
      () =>
        ensureEntryPathDimension({
          propertyId: 'G-QPFCD9VH46',
          accessToken: 't',
          fetchImpl: async () => jsonResponse(200, {}),
        }),
      /numeric property id/
    )
  })

  it('names the missing property id', async () => {
    const previous = process.env.GA4_PROPERTY_ID
    delete process.env.GA4_PROPERTY_ID
    try {
      await assert.rejects(
        () => ensureEntryPathDimension({ accessToken: 't' }),
        /GA4_PROPERTY_ID is not set/
      )
    } finally {
      if (previous === undefined) delete process.env.GA4_PROPERTY_ID
      else process.env.GA4_PROPERTY_ID = previous
    }
  })
})
