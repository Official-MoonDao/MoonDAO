import { ownerDisplayName, toProjectOwnerId } from './projectOwnerId'

describe('ownerDisplayName', () => {
  const names = new Map<number, string>([[25, 'Zephalto'], [0, 'Executive Branch']])
  it('uses the directory name for a known team', () => {
    expect(ownerDisplayName(25, names)).toBe('Zephalto')
    expect(ownerDisplayName(0, names)).toBe('Executive Branch')
  })
  it('falls back to Team N when the team is missing from the list', () => {
    expect(ownerDisplayName(17, names)).toBe('Team 17')
  })
  it('keeps Project N for project-owned ids', () => {
    expect(ownerDisplayName(toProjectOwnerId(5), names)).toBe('Project 5')
  })
})
