import { predictionActionLabel } from '@/components/deprize/betPrimaryAction'

describe('prediction window action label', () => {
  it('stays Predict until a bet amount needs a different action', () => {
    expect(predictionActionLabel({ writing: false, saved: false, bet: null })).to.equal('Predict')
    expect(predictionActionLabel({ writing: true, saved: false, bet: null })).to.equal('Predicting…')
    expect(predictionActionLabel({ writing: false, saved: true, bet: null })).to.equal('Predicted')
  })

  it('switches the same button to add funds when the attached bet cannot be paid', () => {
    expect(
      predictionActionLabel({
        writing: false,
        saved: true,
        bet: { kind: 'fund', label: 'ignored', disabled: false },
      })
    ).to.equal('Add funds to your wallet')
  })

  it('uses the bet label when the attached bet can be placed', () => {
    expect(
      predictionActionLabel({
        writing: false,
        saved: false,
        bet: { kind: 'place', label: 'Bet 0.01 ETH', disabled: false },
      })
    ).to.equal('Bet 0.01 ETH')
  })
})
