import { renderDiscordMessageContent } from '@/lib/discord/formatDiscordMessage'
import React from 'react'

function mountContent(content: string, mentions = []) {
  cy.mount(<div data-testid="msg">{renderDiscordMessageContent(content, mentions)}</div>)
}

describe('renderDiscordMessageContent', () => {
  it('returns null for empty content', () => {
    expect(renderDiscordMessageContent('')).to.equal(null)
  })

  it('renders plain text unchanged', () => {
    mountContent('hello world')
    cy.get('[data-testid="msg"]').should('have.text', 'hello world')
  })

  it('renders user mentions from the mentions list', () => {
    mountContent('hi <@123> and <@!456>', [
      { id: '123', global_name: 'Alice' },
      { id: '456', username: 'bob' },
    ] as any)
    cy.get('[data-testid="msg"]').should('have.text', 'hi @Alice and @bob')
  })

  it('falls back for unknown role and channel ids', () => {
    mountContent('<@&1> <#2>')
    cy.get('[data-testid="msg"]').should('have.text', '@role #channel')
  })

  it('renders nested bold, strike, and code', () => {
    mountContent('**bold <@1>** ~~gone~~ `x`', [{ id: '1', username: 'u' }] as any)
    cy.get('[data-testid="msg"] strong').should('have.text', 'bold @u')
    cy.get('[data-testid="msg"] .line-through').should('have.text', 'gone')
    cy.get('[data-testid="msg"] code').should('have.text', 'x')
  })

  it('renders markdown links with and without angle brackets', () => {
    mountContent('[a](https://a.com) [b](<https://b.com/x>)')
    cy.get('[data-testid="msg"] a').should('have.length', 2)
    cy.get('[data-testid="msg"] a')
      .eq(0)
      .should('have.attr', 'href', 'https://a.com')
      .and('have.text', 'a')
    cy.get('[data-testid="msg"] a')
      .eq(1)
      .should('have.attr', 'href', 'https://b.com/x')
      .and('have.text', 'b')
  })

  it('renders bare and suppressed-embed urls', () => {
    mountContent('see https://a.com/p and <https://b.com>')
    cy.get('[data-testid="msg"] a').eq(0).should('have.attr', 'href', 'https://a.com/p')
    cy.get('[data-testid="msg"] a').eq(1).should('have.attr', 'href', 'https://b.com')
    cy.get('[data-testid="msg"]').should('not.contain.text', '<')
  })

  it('renders newlines as line breaks', () => {
    mountContent('a\nb\nc')
    cy.get('[data-testid="msg"] br').should('have.length', 2)
  })

  it('renders timestamps as time elements', () => {
    mountContent('at <t:1700000000:F> and <t:1700000000>')
    cy.get('[data-testid="msg"] time').should('have.length', 2)
    cy.get('[data-testid="msg"] time')
      .eq(0)
      .should('have.attr', 'datetime', new Date(1700000000 * 1000).toISOString())
      .invoke('text')
      .should('not.be.empty')
    cy.get('[data-testid="msg"]').should('not.contain.text', '<t:')
  })

  it('renders static and animated custom emoji', () => {
    mountContent('<:moon:111> <a:spin:222>')
    cy.get('[data-testid="msg"] img')
      .eq(0)
      .should('have.attr', 'src', 'https://cdn.discordapp.com/emojis/111.png?size=32')
      .and('have.attr', 'alt', ':moon:')
    cy.get('[data-testid="msg"] img')
      .eq(1)
      .should('have.attr', 'src', 'https://cdn.discordapp.com/emojis/222.gif?size=32')
      .and('have.attr', 'alt', ':spin:')
  })

  it('is stable across repeated calls', () => {
    const content = '**a** https://x.com'
    renderDiscordMessageContent(content)
    mountContent(content)
    cy.get('[data-testid="msg"] strong').should('have.text', 'a')
    cy.get('[data-testid="msg"] a').should('have.attr', 'href', 'https://x.com')
  })
})
