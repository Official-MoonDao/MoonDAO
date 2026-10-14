import {
  isProjectOwnerId,
  ownerFallbackName,
  ownerHref,
  parseOwnerId,
  PROJECT_ID_OFFSET,
  toProjectOwnerId,
} from '../lib/project/projectOwnerId'

function expectEqual<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

describe('project owner ids', () => {
  it('round-trips a project id through the offset', () => {
    const encoded = toProjectOwnerId(5)
    expectEqual(encoded, PROJECT_ID_OFFSET + 5, 'encoded')
    expectEqual(parseOwnerId(encoded).kind, 'project', 'kind')
    expectEqual(parseOwnerId(encoded).id, 5, 'id')
  })

  it('keeps team ids as teams', () => {
    expectEqual(isProjectOwnerId(5), false, 'team 5')
    expectEqual(parseOwnerId('5').kind, 'team', 'string team id')
    expectEqual(isProjectOwnerId(null), false, 'null')
    expectEqual(isProjectOwnerId(''), false, 'empty')
  })

  it('treats project 0 as a project', () => {
    expectEqual(isProjectOwnerId(PROJECT_ID_OFFSET), true, 'offset itself')
    expectEqual(parseOwnerId(PROJECT_ID_OFFSET).id, 0, 'project 0')
  })

  it('links projects by MDP and teams by slug or id', () => {
    expectEqual(ownerHref(toProjectOwnerId(3), { projectMDP: 212 }), '/project/212', 'project')
    expectEqual(ownerHref(toProjectOwnerId(3)), '/projects', 'project without MDP')
    expectEqual(ownerHref(7, { teamSlug: 'moon-team' }), '/team/moon-team', 'team slug')
    expectEqual(ownerHref(7), '/team/7', 'team id')
  })

  it('names unresolved owners by kind', () => {
    expectEqual(ownerFallbackName(toProjectOwnerId(3)), 'Project 3', 'project')
    expectEqual(ownerFallbackName(7), 'Team 7', 'team')
  })
})
