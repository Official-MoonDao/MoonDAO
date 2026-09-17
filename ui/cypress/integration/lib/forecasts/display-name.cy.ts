import { forecastTableHandle, publicDisplayName, sanitizeDisplayName } from '@/lib/forecasts/displayName'

describe('forecast public identity', () => {
  it('never publishes the raw Privy id as the Tableland handle', () => {
    const userId = 'did:privy:abc123'
    const handle = forecastTableHandle(userId)
    expect(handle).to.match(/^[a-f0-9]{16}$/)
    expect(handle).to.not.equal(userId)
    expect(handle).to.not.include('privy')
    expect(forecastTableHandle(userId)).to.equal(handle)
  })

  it('changes the handle when FORECAST_ID_PEPPER changes', () => {
    const userId = 'did:privy:abc123'
    const prev = process.env.FORECAST_ID_PEPPER
    process.env.FORECAST_ID_PEPPER = 'pepper-a'
    const a = forecastTableHandle(userId)
    process.env.FORECAST_ID_PEPPER = 'pepper-b'
    const b = forecastTableHandle(userId)
    if (prev === undefined) delete process.env.FORECAST_ID_PEPPER
    else process.env.FORECAST_ID_PEPPER = prev
    expect(a).to.match(/^[a-f0-9]{16}$/)
    expect(b).to.match(/^[a-f0-9]{16}$/)
    expect(a).to.not.equal(b)
  })

  it('prefers an opt-in display name and otherwise uses a pseudonym', () => {
    expect(sanitizeDisplayName('<script>Ada</script>')).to.equal('scriptAdascript')
    expect(publicDisplayName({ optIn: true, displayName: 'Ada' }, 'did:privy:1')).to.equal('Ada')
    expect(publicDisplayName({ optIn: false, displayName: 'Ada' }, 'did:privy:1')).to.match(
      /^Forecaster /
    )
  })
})
