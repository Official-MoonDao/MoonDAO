import {
  DEPRIZE_AVAILABILITY_LEGEND,
  DEPRIZE_PREDICT_CTA,
  DEPRIZE_RESTRICTED_PREDICT_COPY,
  deprizeOgDescription,
} from '@/lib/deprize/constants'

describe('deprize availability legend', () => {
  it('uses the shared non-U.S. availability sentence', () => {
    expect(DEPRIZE_AVAILABILITY_LEGEND).to.equal(
      'Not available to U.S. persons or anyone located in the United States or another restricted jurisdiction.'
    )
  })

  it('puts the legend first in page metadata', () => {
    expect(deprizeOgDescription('Live odds.')).to.equal(
      `${DEPRIZE_AVAILABILITY_LEGEND} Live odds.`
    )
    expect(deprizeOgDescription('')).to.equal(DEPRIZE_AVAILABILITY_LEGEND)
  })

  it('offers a prediction path in the restricted-region copy', () => {
    expect(DEPRIZE_RESTRICTED_PREDICT_COPY).to.match(/prediction/i)
    expect(DEPRIZE_RESTRICTED_PREDICT_COPY).to.match(/leaderboard/i)
    expect(DEPRIZE_PREDICT_CTA).to.equal('Predict')
  })
})
