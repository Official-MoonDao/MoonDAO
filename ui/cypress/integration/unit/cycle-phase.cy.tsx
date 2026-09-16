import { PROJECT_CYCLE } from 'const/config'
import {
  PHASE_ORDER,
  getNextPhase,
  getPhaseFlags,
  resolveLivePhase,
  resolveMemberVoteSubmissionsOpen,
} from '../../../lib/operator/cyclePhase'

const currentStamp = {
  quarter: PROJECT_CYCLE.quarter,
  year: PROJECT_CYCLE.year,
}

const priorStamp = {
  quarter: PROJECT_CYCLE.quarter === 1 ? 4 : PROJECT_CYCLE.quarter - 1,
  year: PROJECT_CYCLE.quarter === 1 ? PROJECT_CYCLE.year - 1 : PROJECT_CYCLE.year,
}

describe('cyclePhase', () => {
  describe('PHASE_ORDER / getNextPhase', () => {
    it('orders intake → senate → member → idle', () => {
      expect(PHASE_ORDER).to.deep.equal(['intake', 'senate', 'member', 'idle'])
    })

    it('advances each phase and stops at idle', () => {
      expect(getNextPhase('intake')).to.equal('senate')
      expect(getNextPhase('senate')).to.equal('member')
      expect(getNextPhase('member')).to.equal('idle')
      expect(getNextPhase('idle')).to.equal(null)
    })
  })

  describe('getPhaseFlags', () => {
    it('sets isIntake only for intake', () => {
      expect(getPhaseFlags('intake')).to.deep.equal({
        isIntake: true,
        isSenateVote: false,
        isMemberVote: false,
        isRewardsCycle: false,
      })
    })

    it('sets senate / member / idle flags', () => {
      expect(getPhaseFlags('senate').isSenateVote).to.equal(true)
      expect(getPhaseFlags('member')).to.deep.include({
        isMemberVote: true,
        isRewardsCycle: true,
        isIntake: false,
      })
      expect(getPhaseFlags('idle').isIntake).to.equal(false)
      expect(getPhaseFlags('idle').isSenateVote).to.equal(false)
    })
  })

  describe('resolveLivePhase', () => {
    it('falls back to PROJECT_CYCLE.phase when the override is null', () => {
      expect(resolveLivePhase(null)).to.equal(PROJECT_CYCLE.phase)
      expect(resolveLivePhase({ phase: null })).to.equal(PROJECT_CYCLE.phase)
    })

    it('honors a matching cycle stamp', () => {
      expect(
        resolveLivePhase({ phase: 'senate', ...currentStamp })
      ).to.equal('senate')
    })

    it('ignores a mismatched cycle stamp', () => {
      expect(
        resolveLivePhase({ phase: 'member', ...priorStamp })
      ).to.equal(PROJECT_CYCLE.phase)
    })

    it('ignores an unstamped override', () => {
      expect(resolveLivePhase({ phase: 'idle' })).to.equal(PROJECT_CYCLE.phase)
    })
  })

  describe('resolveMemberVoteSubmissionsOpen', () => {
    it('is closed outside the member phase', () => {
      expect(
        resolveMemberVoteSubmissionsOpen('intake', {
          phase: 'member',
          memberVoteSubmissionsOpen: true,
          ...currentStamp,
        })
      ).to.equal(false)
      expect(
        resolveMemberVoteSubmissionsOpen('senate', {
          phase: 'member',
          memberVoteSubmissionsOpen: true,
          ...currentStamp,
        })
      ).to.equal(false)
    })

    it('ignores a stale member override', () => {
      expect(
        resolveMemberVoteSubmissionsOpen('member', {
          phase: 'member',
          memberVoteSubmissionsOpen: true,
          ...priorStamp,
        })
      ).to.equal(PROJECT_CYCLE.memberVoteSubmissionsOpen)
    })

    it('treats a stamped legacy phase: member as open', () => {
      expect(
        resolveMemberVoteSubmissionsOpen('member', {
          phase: 'member',
          ...currentStamp,
        })
      ).to.equal(true)
    })

    it('honors an explicit stamped submissions flag', () => {
      expect(
        resolveMemberVoteSubmissionsOpen('member', {
          phase: 'member',
          memberVoteSubmissionsOpen: false,
          ...currentStamp,
        })
      ).to.equal(false)
    })
  })
})
