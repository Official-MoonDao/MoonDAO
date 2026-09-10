import { evaluateEligibility } from '@/lib/deprize/eligibility'
import { isRestrictedJurisdiction } from '@/lib/deprize/restrictedJurisdictions'
import { parseOfacEthList } from '@/lib/deprize/sanctions'
import { hostingLooksLikeProxy, isPrivateOrLocalIp } from '@/lib/deprize/vpnCheck'

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
})
