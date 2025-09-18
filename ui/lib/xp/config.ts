import {
  BanknotesIcon,
  CheckBadgeIcon,
  ShoppingBagIcon,
  UserGroupIcon,
  CodeBracketIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import {
  DEFAULT_CHAIN_V5_SLUG,
  HAS_BOUGHT_A_MARKETPLACE_LISTING_VERIFIER_ADDRESSES,
  HAS_COMPLETED_CITIZEN_PROFILE_VERIFIER_ADDRESSES,
  HAS_CONTRIBUTED_VERIFIER_ADDRESSES,
  HAS_CREATED_A_TEAM_VERIFIER_ADDRESSES,
  HAS_JOINED_A_TEAM_VERIFIER_ADDRESSES,
  HAS_TOKEN_BALANCE_VERIFIER_ADDRESSES,
  HAS_VOTED_VERIFIER_ADDRESSES,
  HAS_VOTING_POWER_VERIFIER_ADDRESSES,
  HAS_SUBMITTED_PR_VERIFIER_ADDRESSES,
  HAS_SUBMITTED_ISSUE_VERIFIER_ADDRESSES,
  CITIZEN_REFERRAL_VERIFIER_ADDRESSES,
} from 'const/config'
import { useContext, useMemo } from 'react'
import toast from 'react-hot-toast'
import CitizenContext from '../citizen/citizen-context'
import toastStyle from '../marketplace/marketplace-utils/toastConfig'

// Static verifiers array for server-side use
export const XP_VERIFIERS = [
  {
    verifierId: 0,
    verifierAddress: HAS_VOTING_POWER_VERIFIER_ADDRESSES[DEFAULT_CHAIN_V5_SLUG],
    route: '/api/xp/voting-power-proof',
    type: 'staged',
    metricKey: 'vp',
    title: 'Voting Power',
    description: 'Stake MOONEY to get vMOONEY and voting power.',
    icon: BanknotesIcon,
    link: '/lock',
    linkText: 'Stake Now',
  },
  {
    verifierId: 1,
    verifierAddress: HAS_VOTED_VERIFIER_ADDRESSES[DEFAULT_CHAIN_V5_SLUG],
    route: '/api/xp/has-voted-proof',
    type: 'staged',
    metricKey: 'votesCount',
    title: 'Votes',
    description: 'Participate in governance by voting on a proposal.',
    icon: CheckBadgeIcon,
    link: '/vote',
    linkText: 'Vote Now',
  },
  {
    verifierId: 2,
    verifierAddress:
      HAS_TOKEN_BALANCE_VERIFIER_ADDRESSES[DEFAULT_CHAIN_V5_SLUG],
    route: '/api/xp/mooney-balance',
    type: 'staged',
    metricKey: 'tokenBalance',
    metricFormatting: (metric: number) =>
      Number(metric / 1e18).toLocaleString(),
    title: 'MOONEY',
    description: 'Hold MOONEY in your wallet.',
    icon: BanknotesIcon,
  },
  // {
  //   verifierId: 3,
  //   verifierAddress:
  //     HAS_CREATED_A_TEAM_VERIFIER_ADDRESSES[DEFAULT_CHAIN_V5_SLUG],
  //   route: '/api/xp/has-created-a-team-proof',
  //   type: 'single',
  //   metricKey: 'teamsCreated',
  //   title: 'Create a Team',
  //   description: 'Create a team in the Space Acceleration Network.',
  //   icon: UserGroupIcon,
  //   link: '/team',
  //   linkText: 'Create Team',
  // },
  {
    verifierId: 4,
    verifierAddress: HAS_CONTRIBUTED_VERIFIER_ADDRESSES[DEFAULT_CHAIN_V5_SLUG],
    route: '/api/xp/has-contributed-proof',
    type: 'staged',
    metricKey: 'contributions',
    title: 'Contributions',
    description: 'Contribute to the community circle.',
    icon: UserGroupIcon,
    link: '/contribute',
    linkText: 'Contribute',
  },
  {
    verifierId: 5,
    verifierAddress:
      HAS_COMPLETED_CITIZEN_PROFILE_VERIFIER_ADDRESSES[DEFAULT_CHAIN_V5_SLUG],
    route: '/api/xp/has-completed-citizen-profile-proof',
    metricKey: 'profileCompleted',
    title: 'Citizen Profile',
    description:
      'Complete your citizen profile: description + location or discord or twitter or website.',
    icon: UserGroupIcon,
    link: 'citizenProfile',
    linkText: 'Complete Profile',
  },
  // {
  //   verifierId: 6,
  //   verifierAddress:
  //     HAS_BOUGHT_A_MARKETPLACE_LISTING_VERIFIER_ADDRESSES[
  //       DEFAULT_CHAIN_V5_SLUG
  //     ],
  //   route: '/api/xp/has-bought-marketplace-listings-proof',
  //   type: 'staged',
  //   metricKey: 'purchaseCount', // Placeholder - update when this API is implemented
  //   title: 'Marketplace Listings',
  //   description: 'Buy a listing in the MoonDAO marketplace',
  //   icon: ShoppingBagIcon,
  //   link: '/marketplace',
  //   linkText: 'Buy Listing',
  // },
  {
    verifierId: 7,
    verifierAddress:
      HAS_JOINED_A_TEAM_VERIFIER_ADDRESSES[DEFAULT_CHAIN_V5_SLUG],
    route: '/api/xp/has-joined-a-team-proof',
    type: 'single',
    metricKey: 'teamsJoined',
    title: 'Join a Team',
    description: 'Join a team in the Space Acceleration Network.',
    icon: UserGroupIcon,
    link: '/network',
    linkText: 'Join Team',
  },
  {
    verifierId: 8,
    verifierAddress:
      HAS_SUBMITTED_ISSUE_VERIFIER_ADDRESSES[DEFAULT_CHAIN_V5_SLUG],
    route: '/api/xp/has-submitted-issue-proof',
    type: 'single',
    metricKey: 'issueCount',
    title: 'Submit an Issue',
    description: 'Submit an issue to a MoonDAO repository.',
    icon: ExclamationTriangleIcon,
    link: 'https://github.com/Official-MoonDao/MoonDAO/issues',
    linkText: 'View Issues',
    errorButtons: {
      'No GitHub account linked to your Privy account': {
        type: 'github_link',
        text: 'Link GitHub Account',
        className:
          'from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700',
      },
    },
  },
  {
    verifierId: 9,
    verifierAddress: HAS_SUBMITTED_PR_VERIFIER_ADDRESSES[DEFAULT_CHAIN_V5_SLUG],
    route: '/api/xp/has-submitted-pr-proof',
    type: 'staged',
    metricKey: 'prCount',
    title: 'Submit PRs',
    description: 'Submit and merge pull requests into a MoonDAO repository.',
    icon: CodeBracketIcon,
    link: 'https://github.com/Official-MoonDao/MoonDAO/pulls',
    linkText: 'View PRs',
    errorButtons: {
      'No GitHub account linked to your Privy account': {
        type: 'github_link',
        text: 'Link GitHub Account',
        className:
          'from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700',
      },
    },
  },
  {
    verifierId: 10,
    verifierAddress: CITIZEN_REFERRAL_VERIFIER_ADDRESSES[DEFAULT_CHAIN_V5_SLUG],
    route: '/api/xp/citizen-referrals',
    type: 'staged',
    metricKey: 'referralCount',
    title: 'Citizen Referrals',
    description: 'Refer your friends to the Space Acceleration Network.',
    icon: UserGroupIcon,
    actionText: 'Copy Referral Link',
  },
]

export function useXPVerifiers() {
  const { citizen } = useContext(CitizenContext)

  const xpVerifiers = useMemo(() => {
    return XP_VERIFIERS.map((verifier) => {
      if (
        verifier.verifierAddress ===
        CITIZEN_REFERRAL_VERIFIER_ADDRESSES[DEFAULT_CHAIN_V5_SLUG]
      ) {
        return {
          ...verifier,
          action: () => {
            navigator.clipboard.writeText(
              `${window.location.origin}/citizen/?referredBy=${citizen.owner}`
            )
            toast.success('Referral link copied to clipboard!', {
              style: toastStyle,
            })
          },
        }
      }
      return verifier
    })
  }, [citizen])

  return xpVerifiers
}
