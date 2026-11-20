/// <reference types="node" />
/// <reference types="mocha" />
import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { isPixelPath, isValidPixelId, pixelAllowed } from './metaPixel'

const allowed = {
  pixelId: '123456789012345',
  analyticsConsent: true as boolean | null,
  globalPrivacyControl: false,
  optedOut: false,
}

describe('metaPixel', () => {
  describe('pixelAllowed', () => {
    it('loads only with a valid id and granted analytics consent', () => {
      assert.strictEqual(pixelAllowed(allowed), true)
    })

    it('never loads without a configured pixel id', () => {
      assert.strictEqual(pixelAllowed({ ...allowed, pixelId: '' }), false)
      assert.strictEqual(pixelAllowed({ ...allowed, pixelId: undefined }), false)
      assert.strictEqual(pixelAllowed({ ...allowed, pixelId: 'not-a-pixel' }), false)
    })

    it('treats unknown or declined consent as no', () => {
      assert.strictEqual(pixelAllowed({ ...allowed, analyticsConsent: null }), false)
      assert.strictEqual(pixelAllowed({ ...allowed, analyticsConsent: false }), false)
    })

    it('honors Global Privacy Control even with consent', () => {
      assert.strictEqual(pixelAllowed({ ...allowed, globalPrivacyControl: true }), false)
    })

    it('honors the Do Not Sell or Share opt-out even with consent', () => {
      assert.strictEqual(pixelAllowed({ ...allowed, optedOut: true }), false)
    })
  })

  describe('isPixelPath', () => {
    it('covers only the membership funnel', () => {
      assert.strictEqual(isPixelPath('/citizenship'), true)
      assert.strictEqual(isPixelPath('/citizenship/decide'), true)
      assert.strictEqual(isPixelPath('/join'), true)
      assert.strictEqual(isPixelPath('/citizen'), true)
      assert.strictEqual(isPixelPath('/join/'), true)
      assert.strictEqual(isPixelPath('/join?utm_medium=paid'), true)
    })

    it('excludes everything else, including Citizen profiles and prediction pages', () => {
      for (const p of [
        '/',
        '/citizen/some-name-12',
        '/moonbase',
        '/deprize',
        '/touchdown',
        '/team',
        '',
        null,
      ]) {
        assert.strictEqual(isPixelPath(p as string | null), false, String(p))
      }
    })
  })

  describe('isValidPixelId', () => {
    it('accepts numeric ids only', () => {
      assert.strictEqual(isValidPixelId('123456789012345'), true)
      assert.strictEqual(isValidPixelId('12345'), false)
      assert.strictEqual(isValidPixelId('123abc456789'), false)
    })
  })

  describe('event payloads', () => {
    const source = fs.readFileSync(path.join(__dirname, 'metaPixel.ts'), 'utf8')

    it('turns off automatic event collection', () => {
      assert.ok(source.includes("fbq('set', 'autoConfig', false, pixelId)"))
    })

    it('does not auto-fire PageView on client-side navigation', () => {
      assert.ok(source.includes('disablePushState = true'))
    })

    it('never sends wallet or contact fields', () => {
      for (const field of ['wallet', 'address', 'email', '"em"', "'em'", 'phone', "'ph'"]) {
        const sendsField = new RegExp(`${field}\\s*:`).test(source)
        assert.strictEqual(sendsField, false, field)
      }
    })
  })
})
