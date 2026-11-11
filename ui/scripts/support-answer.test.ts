/// <reference types="node" />
import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { answerQuestion } from '../lib/support/answer'

const DOCS = [
  { path: '/docs/jobs', body: 'Teams post a job from the team page.' },
  {
    path: '/docs/join',
    body: 'Open the join page.\n\nA year of citizenship costs a small amount of ETH.',
  },
]

const ROOT = path.join(__dirname, '..')

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8')
}

describe('support answer', () => {
  it('quotes the matching paragraph', () => {
    assert.deepStrictEqual(answerQuestion('Where do teams post a job?', DOCS), {
      outcome: 'answered',
      path: '/docs/jobs',
      text: 'Teams post a job from the team page.',
    })
    const cost = answerQuestion('What does a year of citizenship cost?', DOCS)
    assert.strictEqual(cost.outcome, 'answered')
    assert.strictEqual(cost.text, 'A year of citizenship costs a small amount of ETH.')
  })

  it('hands funds, eligibility, and legal questions to a person', () => {
    for (const question of [
      'Can I get a refund of my funds?',
      'Am I eligible?',
      'Is this legal advice?',
    ]) {
      const found = answerQuestion(question, DOCS)
      assert.deepStrictEqual(found, {
        outcome: 'escalated',
        path: null,
        text: 'A person needs to answer this.',
      })
      assert.strictEqual(found.text.includes('ETH'), false)
    }
  })

  it('escalates when no paragraph matches', () => {
    assert.strictEqual(answerQuestion('What is the weather on Mars?', DOCS).outcome, 'escalated')
  })

  it('keeps the page and the footer link free of a stored transcript', () => {
    const page = read('pages/support.tsx')
    const footer = read('components/layout/ExpandedFooter.tsx')
    assert.strictEqual(page.includes('answerQuestion'), true)
    assert.strictEqual(page.includes('discord.com/api'), false)
    assert.strictEqual(page.includes('localStorage'), false)
    assert.strictEqual(page.includes('getServerSideProps'), false)
    assert.strictEqual(footer.includes('href="/support"'), true)
    for (const source of [page, footer]) {
      for (const word of ['deprize', 'betting', 'forecast', 'prize']) {
        assert.strictEqual(source.toLowerCase().includes(word), false, word)
      }
    }
  })
})
