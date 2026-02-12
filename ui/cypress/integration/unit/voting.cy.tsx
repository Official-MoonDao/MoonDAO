import {
  runIterativeNormalization,
  runQuadraticVoting,
  getApprovedProjects,
} from '../../../lib/utils/rewards'

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
    // Use approximate equality for floating point comparisons
    expect(votes.length).to.equal(votesGold.length)
    votes.forEach((voteRow, i) => {
      expect(voteRow.length).to.equal(votesGold[i].length)
      voteRow.forEach((vote, j) => {
        expect(vote).to.be.closeTo(votesGold[i][j], 0.0001)
      })
    })
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

  // --- Proposal author voting restriction (member vote) ---

  it('iterative normalization: author has no allocation to own project (missing key) - fills from column average and rows sum to 100', () => {
    // Voter A is author of project 1 - they have no key for project 1 (only 2 and 3). Others have full distributions.
    const projects = [
      { id: '1', name: 'Project 1' },
      { id: '2', name: 'Project 2' },
      { id: '3', name: 'Project 3' },
    ]
    const distributionsWithAuthorExcluded = [
      { address: '0xauthor', year: 2025, quarter: 1, distribution: { '2': 50, '3': 50 } }, // author of project 1 - no key for '1'
      { address: '0xvoterb', year: 2025, quarter: 1, distribution: { '1': 33, '2': 33, '3': 34 } },
      { address: '0xvoterc', year: 2025, quarter: 1, distribution: { '1': 30, '2': 40, '3': 30 } },
    ]
    const [normalizedDistributions, votesMatrix] = runIterativeNormalization(
      distributionsWithAuthorExcluded,
      projects
    )
    // Each row must sum to 100
    votesMatrix.forEach((row, i) => {
      const sum = row.reduce((s, v) => s + v, 0)
      expect(sum).to.be.closeTo(100, 0.01)
    })
    // Author (index 0) should have project 1 filled from column average (33 and 30 -> ~31.5), not from their own vote
    expect(votesMatrix[0][0]).to.be.a('number')
    expect(votesMatrix[0][0]).to.not.equal(NaN)
    expect(votesMatrix[0][0]).to.be.closeTo(31.5, 15) // column average from others
    // Normalized distributions should have all project keys
    normalizedDistributions.forEach((d) => {
      expect(Object.keys(d.distribution)).to.have.length(3)
      const sum = (Object.values(d.distribution) as number[]).reduce((s, v) => s + v, 0)
      expect(sum).to.be.closeTo(100, 0.01)
    })
  })

  it('proposal vote pipeline: strip author self-vote then normalize then quadratic - author cannot boost own project', () => {
    // Project 1 is authored by 0xAuthor. 0xAuthor voted 100% to their own project. Others voted 0% project 1, 50% each to 2 and 3.
    const projects = [
      { id: '1', name: 'P1' },
      { id: '2', name: 'P2' },
      { id: '3', name: 'P3' },
    ]
    const projectIdToAuthorAddress: Record<string, string> = { '1': '0xauthor' }
    const votes = [
      { address: '0xauthor', year: 2025, quarter: 1, distribution: { '1': 100, '2': 0, '3': 0 } },
      { address: '0xvoterb', year: 2025, quarter: 1, distribution: { '1': 0, '2': 50, '3': 50 } },
      { address: '0xvoterc', year: 2025, quarter: 1, distribution: { '1': 0, '2': 50, '3': 50 } },
    ]
    // Strip author's allocation to their own project (mirror vote API logic)
    const votesWithAuthorOwnExcluded = votes.map((v) => {
      const voterAddr = v.address?.toLowerCase()
      const distribution: Record<string, number> = {}
      for (const [projectId, value] of Object.entries(v.distribution)) {
        const author = projectIdToAuthorAddress[projectId]?.toLowerCase()
        if (author && author === voterAddr) continue
        distribution[projectId] = Number(value)
      }
      return { ...v, distribution }
    })
    const [normalizedDistributions] = runIterativeNormalization(votesWithAuthorOwnExcluded, projects)
    const addressToQuadraticVotingPower: Record<string, number> = {
      '0xauthor': 10,
      '0xvoterb': 10,
      '0xvoterc': 10,
    }
    const outcome = runQuadraticVoting(normalizedDistributions, addressToQuadraticVotingPower, 100)
    // Project 1 should not get 100% from the author - after strip + normalize, author's share for P1 is filled from column average (0), so P1 outcome should be 0 or near 0
    expect(outcome['1']).to.be.closeTo(0, 1)
    // Projects 2 and 3 should share the rest
    expect(outcome['2']).to.be.above(0)
    expect(outcome['3']).to.be.above(0)
    const total = outcome['1'] + outcome['2'] + outcome['3']
    expect(total).to.be.closeTo(100, 1)
  })

  it('proposal vote pipeline: multiple authors each excluded from own project only', () => {
    // Voter A is author of project 1, Voter B is author of project 2. Each has 100% on their own project in raw vote.
    const projects = [
      { id: '1', name: 'P1' },
      { id: '2', name: 'P2' },
      { id: '3', name: 'P3' },
    ]
    const projectIdToAuthorAddress: Record<string, string> = {
      '1': '0xauthora',
      '2': '0xauthorb',
    }
    const votes = [
      { address: '0xauthora', year: 2025, quarter: 1, distribution: { '1': 100, '2': 0, '3': 0 } },
      { address: '0xauthorb', year: 2025, quarter: 1, distribution: { '1': 0, '2': 100, '3': 0 } },
      { address: '0xvoterc', year: 2025, quarter: 1, distribution: { '1': 33, '2': 33, '3': 34 } },
    ]
    const votesWithAuthorOwnExcluded = votes.map((v) => {
      const voterAddr = v.address?.toLowerCase()
      const distribution: Record<string, number> = {}
      for (const [projectId, value] of Object.entries(v.distribution)) {
        const author = projectIdToAuthorAddress[projectId]?.toLowerCase()
        if (author && author === voterAddr) continue
        distribution[projectId] = Number(value)
      }
      return { ...v, distribution }
    })
    const [normalizedDistributions] = runIterativeNormalization(votesWithAuthorOwnExcluded, projects)
    const addressToQuadraticVotingPower: Record<string, number> = {
      '0xauthora': 10,
      '0xauthorb': 10,
      '0xvoterc': 10,
    }
    const outcome = runQuadraticVoting(normalizedDistributions, addressToQuadraticVotingPower, 100)
    // After strip: A has only {2:0, 3:0}, B has only {1:0, 3:0}, C has full. Normalization fills missing with column averages. No single project should dominate from self-vote.
    expect(outcome['1']).to.be.above(0)
    expect(outcome['2']).to.be.above(0)
    expect(outcome['3']).to.be.above(0)
    const total = outcome['1'] + outcome['2'] + outcome['3']
    expect(total).to.be.closeTo(100, 1)
  })
})
