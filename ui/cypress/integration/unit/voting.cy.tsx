import { runIterativeNormalization } from '../../../lib/utils/rewards'

describe('runIterativeNormalization', () => {
  it('should normalize distributions correctly', () => {
    // Source: https://docs.google.com/spreadsheets/d/1oEYeNjJNXQOzP332UO53zo_iWpMmvyEZLXGmgYiJuKE/edit?gid=658868670#gid=658868670
    const testDistributions = [
      {
        distribution: {
          '2': 50,
          '4': 30,
          '3': 20,
          '5': 0,
        },
      },
      {
        distribution: {
          '1': 23,
          '2': 24,
          '4': 49,
          '5': 4,
        },
      },
      {
        distribution: {
          '1': 31,
          '2': 12,
          '4': 42,
          '3': 10,
          '5': 5,
        },
      },
      {
        distribution: {
          '1': 20,
          '2': 20,
          '4': 30,
          '3': 20,
          '5': 10,
        },
      },
      {
        distribution: {
          '1': 30.25,
          '2': 30.25,
          '4': 30.25,
          '3': 9.25,
        },
      },
      {
        distribution: {
          '1': 35,
          '4': 35,
          '3': 20,
          '5': 10,
        },
      },
      {
        distribution: {
          '1': 20.5,
          '2': 22.5,
          '4': 38.5,
          '3': 16.5,
          '5': 2,
        },
      },
      {
        distribution: {
          '1': 48,
          '2': 28,
          '3': 18,
          '5': 6,
        },
      },
    ]

    const projects = [
      { id: '1', title: 'Project 1' },
      { id: '2', title: 'Project 2' },
      { id: '3', title: 'Project 3' },
      { id: '4', title: 'Project 4' },
      { id: '5', title: 'Project 5' },
    ]

    const [normalizedDistributions, votes] = runIterativeNormalization(testDistributions, projects)
    const votesGold = [
      [25.617465382162504, 37.19126730303909, 14.876506921215638, 22.314760381823465, 0],
      [
        19.790022073979447, 20.650457816326366, 13.956425764473845, 42.16135137499968,
        3.441742969387729,
      ],
      [31, 12, 10, 42, 5],
      [20, 20, 20, 30, 10],
      [
        28.85945564992768, 28.85945564992768, 8.824792223531608, 28.85945564992768,
        4.596840826232873,
      ],
      [
        27.00161532655116, 22.852527638146107, 15.429494472314948, 27.00161532655116,
        7.714747236157474,
      ],
      [20.5, 22.5, 16.5, 38.5, 2],
      [
        32.17116462467926, 18.766512697729574, 12.06418673425472, 32.97674039047171,
        4.021395578084907,
      ],
    ]
    // Use approximate equality for floating point comparisons
    expect(votes.length).to.equal(votesGold.length)
    votes.forEach((voteRow, i) => {
      expect(voteRow.length).to.equal(votesGold[i].length)
      voteRow.forEach((vote, j) => {
        expect(vote).to.be.closeTo(votesGold[i][j], 0.0001)
      })
    })
  })
})
