import { generatePrettyLinks } from '@/lib/subscription/pretty-links'

describe('generatePrettyLinks', () => {
  it('Should generate pretty links correctly', () => {
    const input: any = [
      { name: 'Test Link', id: 1 },
      { name: 'Another Link', id: 2 },
      { name: 'Test Link', id: 3 },
    ]

    const expectedOutput = {
      prettyLinks: {
        'test-link': 1,
        'another-link': 2,
        'test-link-3': 3,
      },
      idToPrettyLink: {
        1: 'test-link',
        2: 'another-link',
        3: 'test-link-3',
      },
    }

    const result = generatePrettyLinks(input)
    expect(result).to.deep.equal(expectedOutput)
  })

  it('Should generate all pretty links with tokenId appended', () => {
    const input: any = [
      { name: 'Test Link', id: 1 },
      { name: 'Another Link', id: 2 },
      { name: 'Test Link', id: 3 },
    ]

    const expectedOutput = {
      prettyLinks: {
        'test-link-1': 1,
        'another-link-2': 2,
        'test-link-3': 3,
      },
      idToPrettyLink: {
        1: 'test-link-1',
        2: 'another-link-2',
        3: 'test-link-3',
      },
    }

    const result = generatePrettyLinks(input, { allHaveTokenId: true })
    expect(result).to.deep.equal(expectedOutput)
  })

  it('Should handle empty inputs', () => {
    const input: any = []
    const expectedOutput = {
      prettyLinks: {},
      idToPrettyLink: {},
    }

    const result = generatePrettyLinks(input)
    expect(result).to.deep.equal(expectedOutput)
  })

  it('Should handle input with missing names or ids', () => {
    const input: any = [
      { name: '', id: 1 },
      { name: 'Valid Link', id: null },
      { name: 'Another Valid Link', id: 2 },
    ]

    const expectedOutput = {
      prettyLinks: {
        'another-valid-link': 2,
      },
      idToPrettyLink: {
        2: 'another-valid-link',
      },
    }

    const result = generatePrettyLinks(input)
    expect(result).to.deep.equal(expectedOutput)
  })
})
