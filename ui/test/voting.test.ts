import { expect } from 'chai'
import { iterativeNormalization } from '../lib/utils/voting'

describe('iterativeNormalization', () => {
  it('should normalize distributions correctly', () => {
    const testDistributions = [
      {
        address: '0x679d87D8640e66778c3419D164998E720D7495f6',
        distribution: {
          '2': 50,
          '4': 30,
          '3': 20,
          '5': 0,
        },
        id: 1,
        quarter: 2,
        year: 2024,
      },
      {
        address: '0x9fDf876a50EA8f95017dCFC7709356887025B5BB',
        distribution: {
          '1': 23,
          '2': 24,
          '4': 49,
          '5': 4,
        },
        id: 2,
        quarter: 2,
        year: 2024,
      },
      {
        address: '0x6bFd9e435cF6194c967094959626ddFF4473a836',
        distribution: {
          '1': 31,
          '2': 12,
          '4': 42,
          '3': 10,
          '5': 5,
        },
        id: 3,
        quarter: 2,
        year: 2024,
      },
    ]

    const projects = [
      { id: '1', title: 'Project 1' },
      { id: '2', title: 'Project 2' },
      { id: '3', title: 'Project 3' },
      { id: '4', title: 'Project 4' },
      { id: '5', title: 'Project 5' },
    ]

    const [normalizedDistributions, votes] = iterativeNormalization(
      testDistributions,
      projects
    )

    // Check if all distributions sum up to 100 (or very close to 100 due to floating-point arithmetic)
    normalizedDistributions.forEach((dist) => {
      const sum = Object.values(dist.distribution).reduce((a, b) => a + b, 0)
      expect(sum).to.be.closeTo(100, 0.001)
    })

    // Check if all projects have a value in each distribution
    normalizedDistributions.forEach((dist) => {
      projects.forEach((project) => {
        expect(dist.distribution).to.have.property(project.id)
        expect(dist.distribution[project.id]).to.be.a('number')
      })
    })

    // Check if the votes array has the correct dimensions
    expect(votes).to.have.lengthOf(testDistributions.length)
    votes.forEach((row) => {
      expect(row).to.have.lengthOf(projects.length)
    })

    // You can add more specific checks here based on expected outcomes
  })
})
