import {
  DEPRIZE_AVAILABILITY_LEGEND,
  DEPRIZE_PREDICT_CTA,
  deprizeOgDescription,
  OG_DESCRIPTION_MAX,
} from '@/lib/deprize/constants'

describe('deprize availability legend', () => {
  it('uses the shared non-U.S. availability sentence', () => {
    expect(DEPRIZE_AVAILABILITY_LEGEND).to.equal(
      'Not available to U.S. persons or anyone located in the United States or another restricted jurisdiction.'
    )
  })

  it('leads page metadata with the pitch, then the legend', () => {
    expect(deprizeOgDescription('Live odds.')).to.equal(
      `Live odds. ${DEPRIZE_AVAILABILITY_LEGEND}`
    )
    expect(deprizeOgDescription('')).to.equal(DEPRIZE_AVAILABILITY_LEGEND)
  })

  it('shortens a long pitch so the legend is never truncated', () => {
    const out = deprizeOgDescription('word '.repeat(60))
    expect(out.length).to.be.at.most(OG_DESCRIPTION_MAX)
    expect(out.endsWith(` ${DEPRIZE_AVAILABILITY_LEGEND}`)).to.equal(true)
    expect(out).to.match(/^word( word)*… Not available/)
  })

  it('labels the predict action Predict', () => {
    expect(DEPRIZE_PREDICT_CTA).to.equal('Predict')
  })
})
