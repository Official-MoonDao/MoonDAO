import { evaluateEligibility } from '@/lib/deprize/eligibility'
import { shouldCreatePermanentDenial } from '@/lib/deprize/walletObservations'
import { isRestrictedJurisdiction } from '@/lib/deprize/restrictedJurisdictions'
import { parseOfacEthList } from '@/lib/deprize/sanctions'
import { selectSessionWallet } from '@/lib/deprize/sessionWallet'
import {
  checkVpnOrProxy,
  classifyLocalIp,
  classifyPrivacyFlags,
  hostingLooksLikeProxy,
  isPrivateOrLocalIp,
  vpnResultFromIpapiBody,
} from '@/lib/deprize/vpnCheck'

describe('deprize restricted jurisdictions', () => {
  it('blocks the United States and territories', () => {
    expect(isRestrictedJurisdiction('US')).to.equal(true)
    expect(isRestrictedJurisdiction('PR')).to.equal(true)
    expect(isRestrictedJurisdiction('GU')).to.equal(true)
  })

  it('blocks EU / UK / prediction-market jurisdictions', () => {
    expect(isRestrictedJurisdiction('GB')).to.equal(true)
    expect(isRestrictedJurisdiction('DE')).to.equal(true)
    expect(isRestrictedJurisdiction('AU')).to.equal(true)
    expect(isRestrictedJurisdiction('CA')).to.equal(true)
    expect(isRestrictedJurisdiction('SG')).to.equal(true)
  })

  it('blocks occupied Ukrainian regions without blocking an unknown UA region', () => {
    expect(isRestrictedJurisdiction('UA', '43')).to.equal(true)
    expect(isRestrictedJurisdiction('UA', 'UA-14')).to.equal(true)
    expect(isRestrictedJurisdiction('UA', '30')).to.equal(false)
  })

  it('allows a jurisdiction that is not on Schedule A', () => {
    expect(isRestrictedJurisdiction('CH')).to.equal(false)
    expect(isRestrictedJurisdiction('AR')).to.equal(false)
    expect(isRestrictedJurisdiction(null)).to.equal(false)
  })
})

describe('deprize eligibility decision', () => {
  const base = {
    country: 'CH',
    isVpnOrProxy: false,
    isSanctioned: false,
    screeningFailed: false,
    wallet: '0x1234567890123456789012345678901234567890',
  }

  it('allows a clean request from a permitted country', () => {
    expect(evaluateEligibility(base)).to.deep.equal({
      allowed: true,
      reason: 'ok',
      country: 'CH',
    })
  })

  it('fails closed when the country is unknown', () => {
    expect(evaluateEligibility({ ...base, country: null })).to.include({
      allowed: false,
      reason: 'country-unknown',
    })
  })

  it('rejects restricted jurisdictions, VPNs, and sanctioned wallets', () => {
    expect(evaluateEligibility({ ...base, country: 'US' }).reason).to.equal(
      'restricted-jurisdiction'
    )
    expect(evaluateEligibility({ ...base, isVpnOrProxy: true }).reason).to.equal('vpn-or-proxy')
    expect(evaluateEligibility({ ...base, isSanctioned: true }).reason).to.equal(
      'sanctioned-wallet'
    )
  })

  it('fails closed when a screen cannot run', () => {
    expect(evaluateEligibility({ ...base, screeningFailed: true }).reason).to.equal(
      'screening-unavailable'
    )
  })

  it('rejects a malformed wallet', () => {
    expect(evaluateEligibility({ ...base, wallet: 'not-an-address' }).reason).to.equal(
      'invalid-wallet'
    )
  })

  it('rejects a denied wallet even when screening is unavailable', () => {
    expect(
      evaluateEligibility({ ...base, isDeniedWallet: true, screeningFailed: true }).reason
    ).to.equal('wallet-denied')
    expect(evaluateEligibility({ ...base, isDeniedWallet: true }).reason).to.equal(
      'wallet-denied'
    )
  })
})

describe('deprize permanent denial triggers', () => {
  it('creates a denial only for restricted-country and sanctioned wallets', () => {
    expect(shouldCreatePermanentDenial('restricted-jurisdiction')).to.equal(true)
    expect(shouldCreatePermanentDenial('sanctioned-wallet')).to.equal(true)
    expect(shouldCreatePermanentDenial('vpn-or-proxy')).to.equal(false)
    expect(shouldCreatePermanentDenial('country-unknown')).to.equal(false)
    expect(shouldCreatePermanentDenial('screening-unavailable')).to.equal(false)
    expect(shouldCreatePermanentDenial('ok')).to.equal(false)
  })
})

describe('deprize sanctions list parsing', () => {
  it('keeps only hex addresses and lowercases them', () => {
    const set = parseOfacEthList(
      '# comment\n0x7F367cC41522cE07553e823bf3be79A889DEbe1B\nnot-an-address\n'
    )
    expect(set.has('0x7f367cc41522ce07553e823bf3be79a889debe1b')).to.equal(true)
    expect(set.size).to.equal(1)
  })
})

describe('deprize vpn heuristics', () => {
  it('treats RFC1918 and loopback as local', () => {
    expect(isPrivateOrLocalIp('0.0.0.0')).to.equal(true)
    expect(isPrivateOrLocalIp('127.0.0.1')).to.equal(true)
    expect(isPrivateOrLocalIp('10.0.0.8')).to.equal(true)
    expect(isPrivateOrLocalIp('192.168.1.10')).to.equal(true)
    expect(isPrivateOrLocalIp('172.16.0.2')).to.equal(true)
    expect(isPrivateOrLocalIp('172.31.255.1')).to.equal(true)
    expect(isPrivateOrLocalIp('172.15.0.1')).to.equal(false)
    expect(isPrivateOrLocalIp('8.8.8.8')).to.equal(false)
  })

  it('flags known hosting / VPN org strings', () => {
    expect(hostingLooksLikeProxy('M247 LTD VPN')).to.equal(true)
    expect(hostingLooksLikeProxy('DigitalOcean, LLC')).to.equal(true)
    expect(hostingLooksLikeProxy('Comcast Cable')).to.equal(false)
  })

  it('does not treat an Akamai org name alone as hosting', () => {
    expect(hostingLooksLikeProxy('Akamai Technologies')).to.equal(false)
  })

  it('does not match short tokens inside unrelated words', () => {
    expect(hostingLooksLikeProxy('Laws & Associates')).to.equal(false)
    expect(hostingLooksLikeProxy('Amazon Web Services')).to.equal(false)
    expect(hostingLooksLikeProxy('AWS')).to.equal(true)
  })

  it('blocks VPN, proxy, and Tor flags', () => {
    expect(classifyPrivacyFlags({ vpn: true }).kind).to.equal('vpn')
    expect(classifyPrivacyFlags({ vpn: true }).isVpnOrProxy).to.equal(true)
    expect(classifyPrivacyFlags({ proxy: true }).kind).to.equal('proxy')
    expect(classifyPrivacyFlags({ proxy: true }).isVpnOrProxy).to.equal(true)
    expect(classifyPrivacyFlags({ tor: true }).kind).to.equal('tor')
    expect(classifyPrivacyFlags({ tor: true }).isVpnOrProxy).to.equal(true)
  })

  it('allows Apple Private Relay even when hosting is also set', () => {
    const result = classifyPrivacyFlags({ relay: true, hosting: true })
    expect(result.kind).to.equal('relay')
    expect(result.isVpnOrProxy).to.equal(false)
    expect(result.isLocationPreservingRelay).to.equal(true)
  })

  it('blocks bare hosting egress', () => {
    const result = classifyPrivacyFlags({ relay: false, hosting: true })
    expect(result.kind).to.equal('hosting')
    expect(result.isVpnOrProxy).to.equal(true)
  })

  it('fails closed on a private IP in production and allows it in development', () => {
    expect(classifyLocalIp(true)).to.include({ failed: true, kind: 'unknown' })
    expect(classifyLocalIp(false)).to.include({ failed: false, kind: 'clear', isVpnOrProxy: false })
  })

  it('fails closed on a missing client IP', async () => {
    expect(await checkVpnOrProxy('')).to.include({
      isVpnOrProxy: false,
      failed: true,
      kind: 'unknown',
    })
  })

  it('fails closed on ipapi error bodies and missing signals', () => {
    expect(vpnResultFromIpapiBody({ error: true })).to.include({
      isVpnOrProxy: false,
      failed: true,
    })
    expect(vpnResultFromIpapiBody({})).to.include({
      isVpnOrProxy: false,
      failed: true,
    })
    expect(
      vpnResultFromIpapiBody({ security: { vpn: true, proxy: false, tor: false, hosting: false } })
    ).to.include({ isVpnOrProxy: true, failed: false, kind: 'vpn' })
    expect(vpnResultFromIpapiBody({ org: 'Comcast Cable' })).to.include({
      isVpnOrProxy: false,
      failed: false,
      kind: 'clear',
    })
    expect(vpnResultFromIpapiBody({ security: { relay: true, hosting: true } })).to.include({
      isVpnOrProxy: false,
      kind: 'relay',
      failed: false,
    })
  })
})

describe('deprize session wallet binding', () => {
  const a = '0x1234567890123456789012345678901234567890'
  const b = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'

  it('rejects a claimed wallet that is not in the session', () => {
    expect(selectSessionWallet([a], b)).to.equal(null)
  })

  it('returns the claimed session wallet even when several are linked', () => {
    expect(selectSessionWallet([a, b], `0x${b.slice(2).toUpperCase()}`)?.toLowerCase()).to.equal(b)
  })

  it('uses the only session wallet when none is claimed', () => {
    expect(selectSessionWallet([a])?.toLowerCase()).to.equal(a)
    expect(selectSessionWallet([a, b])).to.equal(null)
  })
})
