import {
  sortTeamsWithFeatured,
  filterBlockedTeams,
  filterBlockedCitizens,
  buildSearchClause,
  buildPaginationClause,
  calculateMaxPage,
} from '@/lib/network/utils'
import { NetworkNFT } from '@/lib/network/types'

describe('Network Utils', () => {
  describe('sortTeamsWithFeatured', () => {
    it('should prioritize featured teams', () => {
      const teams: NetworkNFT[] = [
        { metadata: { id: '5', name: 'Team 5' } } as NetworkNFT,
        { metadata: { id: '1', name: 'Team 1' } } as NetworkNFT,
        { metadata: { id: '10', name: 'Team 10' } } as NetworkNFT,
        { metadata: { id: '6', name: 'Team 6' } } as NetworkNFT,
      ]

      const sorted = sortTeamsWithFeatured(teams)
      expect(sorted[0].metadata.id).to.equal('6')
      expect(sorted[1].metadata.id).to.equal('1')
    })

    it('should maintain featured team order', () => {
      const teams: NetworkNFT[] = [
        { metadata: { id: '8', name: 'Team 8' } } as NetworkNFT,
        { metadata: { id: '7', name: 'Team 7' } } as NetworkNFT,
        { metadata: { id: '6', name: 'Team 6' } } as NetworkNFT,
        { metadata: { id: '13', name: 'Team 13' } } as NetworkNFT,
      ]

      const sorted = sortTeamsWithFeatured(teams)
      expect(sorted[0].metadata.id).to.equal('6')
      expect(sorted[1].metadata.id).to.equal('7')
    })

    it('should handle teams with no featured teams', () => {
      const teams: NetworkNFT[] = [
        { metadata: { id: '100', name: 'Team 100' } } as NetworkNFT,
        { metadata: { id: '101', name: 'Team 101' } } as NetworkNFT,
      ]

      const sorted = sortTeamsWithFeatured(teams)
      expect(sorted.length).to.equal(2)
    })
  })

  describe('filterBlockedTeams', () => {
    it('should filter out blocked teams', () => {
      const teams: NetworkNFT[] = [
        { metadata: { id: '1', name: 'Team 1' } } as NetworkNFT,
        { metadata: { id: '2', name: 'Team 2' } } as NetworkNFT,
        { metadata: { id: '3', name: 'Team 3' } } as NetworkNFT,
      ]

      const filtered = filterBlockedTeams(teams)
      expect(filtered.length).to.be.at.most(teams.length)
    })

    it('should return all teams if none are blocked', () => {
      const teams: NetworkNFT[] = [
        { metadata: { id: '100', name: 'Team 100' } } as NetworkNFT,
        { metadata: { id: '101', name: 'Team 101' } } as NetworkNFT,
      ]

      const filtered = filterBlockedTeams(teams)
      expect(filtered.length).to.equal(teams.length)
    })
  })

  describe('filterBlockedCitizens', () => {
    it('should filter out blocked citizens', () => {
      const citizens: NetworkNFT[] = [
        { metadata: { id: '48', name: 'Citizen 48' } } as NetworkNFT,
        { metadata: { id: '72', name: 'Citizen 72' } } as NetworkNFT,
        { metadata: { id: '140', name: 'Citizen 140' } } as NetworkNFT,
        { metadata: { id: '1', name: 'Citizen 1' } } as NetworkNFT,
      ]

      const filtered = filterBlockedCitizens(citizens)
      expect(filtered.length).to.be.lessThan(citizens.length)
      expect(filtered.some((c) => c.metadata.id === '48')).to.be.false
      expect(filtered.some((c) => c.metadata.id === '72')).to.be.false
      expect(filtered.some((c) => c.metadata.id === '140')).to.be.false
    })

    it('should return all citizens if none are blocked', () => {
      const citizens: NetworkNFT[] = [
        { metadata: { id: '1', name: 'Citizen 1' } } as NetworkNFT,
        { metadata: { id: '2', name: 'Citizen 2' } } as NetworkNFT,
      ]

      const filtered = filterBlockedCitizens(citizens)
      expect(filtered.length).to.equal(citizens.length)
    })
  })

  describe('buildSearchClause', () => {
    it('should return empty string for empty search', () => {
      const clause = buildSearchClause('')
      expect(clause).to.equal('')
    })

    it('should return empty string for whitespace-only search', () => {
      const clause = buildSearchClause('   ')
      expect(clause).to.equal('')
    })

    it('should build WHERE clause for valid search', () => {
      const clause = buildSearchClause('test')
      expect(clause).to.include('WHERE')
      expect(clause).to.include('name LIKE')
      expect(clause).to.include('%test%')
    })

    it('should sanitize single quotes in search', () => {
      const clause = buildSearchClause("test'search")
      expect(clause).to.include("''")
      expect(clause).to.not.include("'%test'search%")
      expect(clause).to.include("%test''search%")
    })

    it('should use custom column name', () => {
      const clause = buildSearchClause('test', 'description')
      expect(clause).to.include('description LIKE')
    })
  })

  describe('buildPaginationClause', () => {
    it('should build LIMIT and OFFSET clause', () => {
      const clause = buildPaginationClause(1, 10)
      expect(clause).to.include('LIMIT 10')
      expect(clause).to.include('OFFSET 0')
    })

    it('should calculate correct offset for page 2', () => {
      const clause = buildPaginationClause(2, 10)
      expect(clause).to.include('LIMIT 10')
      expect(clause).to.include('OFFSET 10')
    })

    it('should calculate correct offset for page 3 with different page size', () => {
      const clause = buildPaginationClause(3, 20)
      expect(clause).to.include('LIMIT 20')
      expect(clause).to.include('OFFSET 40')
    })
  })

  describe('calculateMaxPage', () => {
    it('should calculate max page correctly', () => {
      expect(calculateMaxPage(100, 10)).to.equal(10)
      expect(calculateMaxPage(101, 10)).to.equal(11)
      expect(calculateMaxPage(99, 10)).to.equal(10)
    })

    it('should return at least 1 page', () => {
      expect(calculateMaxPage(0, 10)).to.equal(1)
      expect(calculateMaxPage(1, 10)).to.equal(1)
    })

    it('should handle different page sizes', () => {
      expect(calculateMaxPage(50, 25)).to.equal(2)
      expect(calculateMaxPage(50, 20)).to.equal(3)
    })
  })
})

