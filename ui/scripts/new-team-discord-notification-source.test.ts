/// <reference types="node" />
import { expect } from 'chai'
import fs from 'fs'
import path from 'path'

/**
 * Source guards so team sign-up announcements cannot silently regress to the
 * client-side `/api/discord/send` path that dropped Zephalto (token 25).
 */
describe('CreateTeam Discord announcement wiring', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../components/onboarding/CreateTeam.tsx'),
    'utf8'
  )

  it('posts new-team announcements through the dedicated notify route', () => {
    expect(source).to.include('/api/discord/notify-new-team')
    expect(source).to.include('sendOnchainNotification')
  })

  it('does not send the announcement through the unauthenticated helper', () => {
    expect(source).to.not.include('sendDiscordMessage')
    expect(source).to.not.match(/fetch\([`'"]\/api\/discord\/send/)
  })

  it('does not wait 10 seconds after mint before announcing', () => {
    expect(source).to.not.include('10000')
    expect(source).to.not.include('_timestamp=123456789')
  })
})
