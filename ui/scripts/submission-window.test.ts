import { PROJECT_CYCLE } from 'const/config'
import {
  formatSubmissionWindowClose,
  getSubmissionCycleInfo,
  getSubmissionWindowClose,
  submissionWindowClosesAt,
} from '../lib/utils/dates'

function expectEqual<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

describe('submission window close', () => {
  it('closes at 3:00 AM Pacific the morning after the deadline', () => {
    // October 8, 2026 is still PDT (UTC-7), so 3:00 AM Pacific is 10:00 UTC.
    expectEqual(
      submissionWindowClosesAt('October 8, 2026').toISOString(),
      '2026-10-09T10:00:00.000Z',
      'October 8 deadline'
    )
  })

  it('adds grace days on the Pacific calendar', () => {
    expectEqual(
      submissionWindowClosesAt('October 8, 2026', 1).toISOString(),
      '2026-10-10T10:00:00.000Z',
      'one extra day'
    )
  })

  it('uses PST after daylight saving ends', () => {
    // January 8, 2027 → 3:00 AM Pacific on January 9 is PST (UTC-8).
    expectEqual(
      submissionWindowClosesAt('January 8, 2027').toISOString(),
      '2027-01-09T11:00:00.000Z',
      'winter close'
    )
  })

  it('resolves 3:00 AM Pacific on the fall-back Sunday', () => {
    // DST ends 2:00 AM on November 1, 2026, so 3:00 AM that morning is PST.
    expectEqual(
      submissionWindowClosesAt('October 31, 2026').toISOString(),
      '2026-11-01T11:00:00.000Z',
      'fall-back morning'
    )
  })

  it('resolves 3:00 AM Pacific on the spring-forward Sunday', () => {
    // DST starts 2:00 AM on March 14, 2027; clocks jump to 3:00 AM PDT.
    expectEqual(
      submissionWindowClosesAt('March 13, 2027').toISOString(),
      '2027-03-14T10:00:00.000Z',
      'spring-forward morning'
    )
  })

  it('keeps Q4 2026 open until 3:00 AM Pacific on October 10', () => {
    expectEqual(PROJECT_CYCLE.submissionDeadline, 'October 8, 2026', 'advertised deadline')
    expectEqual(PROJECT_CYCLE.submissionGraceDays, 1, 'one-cycle extension')
    const closesAt = getSubmissionWindowClose()
    expectEqual(closesAt.toISOString(), '2026-10-10T10:00:00.000Z', 'Q4 close instant')
    expectEqual(
      formatSubmissionWindowClose(closesAt).label,
      'October 10, 2026, 3:00 AM Pacific',
      'Q4 close label'
    )
    expectEqual(formatSubmissionWindowClose(closesAt).timeLabel, '3:00 AM Pacific', 'Q4 close time')
    expectEqual(
      getSubmissionCycleInfo('intake').deadlineFormatted,
      'October 10, 2026, 3:00 AM Pacific',
      'confirmation email close'
    )
  })
})
