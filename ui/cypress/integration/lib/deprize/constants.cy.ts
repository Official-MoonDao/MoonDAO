import {
  DEPRIZE_AVAILABILITY_LEGEND,
  DEPRIZE_PREDICT_CTA,
  deprizeOgDescription,
  OG_DESCRIPTION_MAX,
} from '@/lib/deprize/constants'

describe('deprize availability legend', () => {
  it('states worldwide predictions and restricted ETH staking', () => {
    expect(DEPRIZE_AVAILABILITY_LEGEND).to.equal(
      'Predictions are open worldwide. Adding ETH to a prediction is unavailable in restricted jurisdictions.'
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
    expect(out).to.match(/^word( word)*… Predictions are open worldwide\./)
  })

  it('labels the predict action Predict', () => {
    expect(DEPRIZE_PREDICT_CTA).to.equal('Predict')
  })
})
