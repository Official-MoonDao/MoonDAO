import fs from 'fs'
import path from 'path'

const UI_ROOT = path.resolve(__dirname, '../../../../')

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, acc)
    else if (/\.(ts|tsx)$/.test(entry.name)) acc.push(full)
  }
  return acc
}

describe('discord G1 hygiene', () => {
  const files = [
    'lib/discord/verifyInteraction.ts',
    'lib/discord/escapeUserText.ts',
    'lib/discord/postChannelMessage.ts',
    'lib/discord/handleInteraction.ts',
    'lib/discord/prizeArg.ts',
    'lib/discord/outcomeLabels.ts',
    'lib/discord/oddsWireStore.ts',
    'pages/api/discord/interactions.ts',
    'pages/api/discord/send.ts',
    'pages/api/cron/deprize-odds-wire.ts',
    'lib/deprize/oddsWire.ts',
  ].map((rel) => path.join(UI_ROOT, rel))

  it('does not call evaluateEligibility, forecast POST, or the browser send helper', () => {
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8')
      expect(text.includes('evaluateEligibility'), file).to.equal(false)
      expect(text.includes('sendDiscordMessage'), file).to.equal(false)
      expect(/\/api\/forecasts\/submit/.test(text), file).to.equal(false)
    }
  })

  it('has exactly one escapeDiscordUserText helper', () => {
    const hits = walk(path.join(UI_ROOT, 'lib')).filter((file) => {
      const text = fs.readFileSync(file, 'utf8')
      return /export function escapeDiscordUserText/.test(text)
    })
    expect(hits.map((f) => path.relative(UI_ROOT, f))).to.deep.equal([
      'lib/discord/escapeUserText.ts',
    ])
  })
})
