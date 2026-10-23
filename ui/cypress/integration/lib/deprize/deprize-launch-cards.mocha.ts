import { deprizeLaunchCards } from '@/lib/launchpad/deprizeLaunchCards'

const rows = [
  { id: 0, projectId: 82, uri: 'ipfs://bafkreidemo' },
  { id: 1, projectId: 83, uri: 'https://moondao.com/deprize/shared-next-landing' },
  { id: 2, projectId: 84, uri: 'https://moondao.com/deprize/shared-night-shift' },
  { id: 3, projectId: 85, uri: 'https://moondao.com/deprize/shared-first-tracks' },
  { id: 4, projectId: 86, uri: 'https://moondao.com/deprize/shared-ice' },
]

describe('deprizeLaunchCards', () => {
  it('lists the four races and leaves the internal demo off', () => {
    const cards = deprizeLaunchCards(rows)
    expect(cards.map((card) => card.title)).to.deep.equal([
      'Touchdown',
      'Night Shift',
      'First Tracks',
      'Water Ice',
    ])
    expect(cards.map((card) => card.href)).to.deep.equal([
      '/deprize/shared-next-landing',
      '/deprize/shared-night-shift',
      '/deprize/shared-first-tracks',
      '/deprize/shared-ice',
    ])
    expect(cards.some((card) => card.id === '0')).to.equal(false)
  })

  it('replaces the current Touchdown card with the newer mission', () => {
    const cards = deprizeLaunchCards([
      ...rows,
      { id: 5, projectId: 87, uri: 'https://moondao.com/deprize/shared-next-landing' },
    ])
    const touchdown = cards.filter((card) => card.href === '/deprize/shared-next-landing')
    expect(touchdown).to.have.length(1)
    expect(touchdown[0].id).to.equal('5')
    expect(touchdown[0].projectId).to.equal('87')
    expect(cards).to.have.length(4)
  })
})
