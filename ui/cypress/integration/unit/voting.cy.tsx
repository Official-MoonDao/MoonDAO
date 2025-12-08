import { runIterativeNormalization, getApprovedProjects } from '../../../lib/utils/rewards'

describe('voting', () => {
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
    expect(votes).to.deep.equal(votesGold)
  })
  it('getApprovedProjects all approved', () => {
    const projects = [1, 2]
    const outcome = { 1: 0.5, 2: 0.5 }
    const ethBudgets = { 1: 0.1, 2: 0.1 }
    const ethBudget = 1
    const projectIdToApproved = getApprovedProjects(projects, outcome, ethBudgets, ethBudget)
    expect(projectIdToApproved[1]).to.be.true
    expect(projectIdToApproved[2]).to.be.true
  })

  it('getApprovedProjects at least 3 approved', () => {
    const projects = [1, 2, 3, 4]
    const outcome = { 1: 0.5, 2: 0.25, 3: 0.25, 4: 0 }
    const ethBudgets = { 1: 0.1, 2: 0.1, 3: 0.1, 4: 0.1 }
    const ethBudget = 1
    const projectIdToApproved = getApprovedProjects(projects, outcome, ethBudgets, ethBudget)
    expect(projectIdToApproved[1]).to.be.true
    expect(projectIdToApproved[2]).to.be.true
    expect(projectIdToApproved[3]).to.be.true
    expect(projectIdToApproved[4]).to.be.false
  })

  it('getApprovedProjects over 3/4 of budget', () => {
    const projects = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const outcome = {
      1: 0.11,
      2: 0.11,
      3: 0.11,
      4: 0.11,
      5: 0.11,
      6: 0.09,
      7: 0.09,
      8: 0.09,
      9: 0.09,
      10: 0.09,
    }
    const ethBudgets = {
      1: 0.2,
      2: 0.2,
      3: 0.2,
      4: 0.2,
      5: 0.2,
      6: 0.2,
      7: 0.2,
      8: 0.2,
      9: 0.2,
      10: 0.2,
    }
    const ethBudget = 1
    // With 0.2 budget, 4 projects would be 0.8 > 0.75, so we should only approve 3
    const projectIdToApproved = getApprovedProjects(projects, outcome, ethBudgets, ethBudget)
    expect(projectIdToApproved[1]).to.be.true
    expect(projectIdToApproved[2]).to.be.true
    expect(projectIdToApproved[3]).to.be.true
    expect(projectIdToApproved[4]).to.be.false
    expect(projectIdToApproved[5]).to.be.false
    expect(projectIdToApproved[6]).to.be.false
    expect(projectIdToApproved[7]).to.be.false
    expect(projectIdToApproved[8]).to.be.false
    expect(projectIdToApproved[9]).to.be.false
    expect(projectIdToApproved[10]).to.be.false
  })

  it('getApprovedProjects odd number of projects rounds up', () => {
    const projects = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const outcome = {
      1: 0.11,
      2: 0.11,
      3: 0.11,
      4: 0.11,
      5: 0.11,
      6: 0.09,
      7: 0.09,
      8: 0.09,
      9: 0.09,
    }
    const ethBudgets = {
      1: 0.1,
      2: 0.1,
      3: 0.1,
      4: 0.1,
      5: 0.1,
      6: 0.1,
      7: 0.1,
      8: 0.1,
      9: 0.1,
    }
    const ethBudget = 1
    // With 0.2 budget, 4 projects would be 0.8 > 0.75, so we should only approve 3
    const projectIdToApproved = getApprovedProjects(projects, outcome, ethBudgets, ethBudget)
    expect(projectIdToApproved[1]).to.be.true
    expect(projectIdToApproved[2]).to.be.true
    expect(projectIdToApproved[3]).to.be.true
    expect(projectIdToApproved[4]).to.be.true
    expect(projectIdToApproved[5]).to.be.true
    expect(projectIdToApproved[6]).to.be.false
    expect(projectIdToApproved[7]).to.be.false
    expect(projectIdToApproved[8]).to.be.false
    expect(projectIdToApproved[9]).to.be.false
  })
})
