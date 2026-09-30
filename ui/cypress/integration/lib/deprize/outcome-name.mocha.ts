import { outcomeWinnerName, outcomeWinnerNameAt } from '@/lib/deprize/outcomeName'

describe('deprize outcome names', () => {
  it('uses the vehicle name, and Open Field for the field slot', () => {
    expect(
      outcomeWinnerName({ projectId: 'ispace-apex', teamId: 606, vehicleLabel: 'ispace' }, 5)
    ).to.equal('ispace')
    expect(
      outcomeWinnerName(
        { projectId: '__open-field__', teamId: 24, field: true },
        6
      )
    ).to.equal('Open Field')
    expect(outcomeWinnerName(undefined, 3)).to.equal('Outcome 4')
  })

  it('matches a roster slot by team id when the lists are not index-aligned', () => {
    const outcomes = [
      { projectId: 'astrobotic-griffin', teamId: 601, vehicleLabel: 'Griffin Mission One' },
      { projectId: 'ispace-apex', teamId: 606, vehicleLabel: 'ispace' },
    ]
    expect(outcomeWinnerNameAt(outcomes, [606n], 0)).to.equal('ispace')
  })
})