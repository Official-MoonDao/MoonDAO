import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { renderDiscordMessageContent } from '@/lib/discord/formatDiscordMessage'
import { isMessageContentRedacted } from '@/lib/discord/messageContent'

function html(content: string, mentions: any[] = []) {
  return renderToStaticMarkup(<div>{renderDiscordMessageContent(content, mentions)}</div>)
}

// Raw Discord syntax that should never reach the dashboard.
const RAW_TOKEN = /&lt;(t:|a?:\w+:\d|@|#|https?:)|\]\(/

describe('renderDiscordMessageContent edge cases', () => {
  it('does not link non-http schemes', () => {
    expect(html('[click](javascript:alert(1))')).to.not.include('href="javascript:')
  })

  it('renders timestamps in every Discord style', () => {
    const seconds = 1790881200
    for (const style of ['', ':t', ':T', ':d', ':D', ':f', ':F', ':R']) {
      const out = html(`Town Hall <t:${seconds}${style}>`)
      expect(out, style || 'default').to.include(
        `dateTime="${new Date(seconds * 1000).toISOString()}"`
      )
      expect(out, style || 'default').to.not.match(RAW_TOKEN)
    }
  })

  it('renders relative timestamps relative to now', () => {
    const inTwoDays = Math.floor(Date.now() / 1000) + 2 * 86_400 + 60
    expect(html(`<t:${inTwoDays}:R>`)).to.match(/in 2 days/)
  })

  it('keeps scanning after a token nested in bold', () => {
    const out = html(
      '**Starts <t:1790881200:R>** then [RSVP](<https://lu.ma/x>) and <#914976122855374958>'
    )
    expect(out).to.match(/<strong[^>]*>Starts <time/)
    expect(out).to.include('href="https://lu.ma/x"')
    expect(out).to.include('#announcements')
    expect(out).to.not.match(RAW_TOKEN)
  })

  it('resolves known role and channel names', () => {
    const out = html('<@&914973269709447238> in <#914976122855374958>')
    expect(out).to.include('@Astronauts')
    expect(out).to.include('#announcements')
  })
})

describe('isMessageContentRedacted', () => {
  const blank = { content: '', embeds: [], attachments: [] }

  it('flags a page where every message came back empty', () => {
    expect(isMessageContentRedacted([blank, blank, blank])).to.equal(true)
  })

  it('does not flag a page with any readable message', () => {
    expect(isMessageContentRedacted([blank, { ...blank, content: 'hello' }])).to.equal(false)
    expect(isMessageContentRedacted([blank, { ...blank, attachments: [{}] }])).to.equal(false)
    expect(isMessageContentRedacted([blank, { ...blank, embeds: [{}] }])).to.equal(false)
  })

  it('does not flag empty or malformed responses', () => {
    expect(isMessageContentRedacted([])).to.equal(false)
    expect(isMessageContentRedacted({ message: 'error' })).to.equal(false)
    expect(isMessageContentRedacted(null)).to.equal(false)
  })
})
