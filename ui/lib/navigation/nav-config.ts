import {
  CircleStackIcon,
  FolderIcon,
  RocketLaunchIcon,
  UserGroupIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline'
import type { ComponentType } from 'react'

export type NavItem = {
  name: string
  href: string
}

export type NavGroup = NavItem & {
  icon: ComponentType<{ className?: string }>
  /**
   * Shown in the top bar, the mobile drawer, and the footer.
   *
   * A group's own `href` is its first destination, so it never appears here
   * too — that double-listing ("Projects" and "Explore Projects" pointing at
   * `/projects`) is what made the old menu twice the size it needed to be.
   */
  children: NavItem[]
  /**
   * Footer only. Real pages that do not earn a slot in the bar: reference
   * material, templates, and archives people reach from a page they are
   * already on, or from search.
   */
  footerOnly?: NavItem[]
  /**
   * Route prefixes this group owns, for highlighting the active item. Matched
   * with `startsWith` against `router.pathname`, so `/project` also covers
   * `/project/[id]`. The group's own `href` and its children's are implied.
   */
  ownedPaths?: string[]
}

/**
 * The navigation, in one place.
 *
 * `useNavigation` (top bar + mobile drawer) and `ExpandedFooter` both read
 * from here. They used to keep their own hand-written copies, which had
 * already drifted apart — "Create a Team" pointed at `/team` in the bar and
 * `/join` in the footer, and the footer never grew columns for Moon Base Zero
 * or DePrize at all.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    name: 'Network',
    href: '/network',
    icon: UserGroupIcon,
    children: [
      { name: 'Citizens', href: '/network?tab=citizens' },
      { name: 'Teams', href: '/network?tab=teams' },
      { name: 'Map', href: '/map' },
      { name: 'Jobs', href: '/jobs' },
      { name: 'Marketplace', href: '/marketplace' },
    ],
    footerOnly: [
      { name: 'Become a Citizen', href: '/citizen' },
      { name: 'Create a Team', href: '/team' },
    ],
    ownedPaths: ['/network', '/map', '/jobs', '/marketplace', '/citizen', '/team', '/join'],
  },
  {
    name: 'Projects',
    href: '/projects',
    icon: WrenchScrewdriverIcon,
    children: [
      { name: 'Propose a Project', href: '/proposals' },
      { name: 'Submit a Contribution', href: '/contributions' },
      { name: 'How the project system works', href: '/projects-overview' },
    ],
    footerOnly: [
      { name: 'Proposal Template', href: '/proposal-template' },
      { name: 'Final Reports', href: '/final-reports' },
    ],
    ownedPaths: [
      '/projects',
      '/project',
      '/proposals',
      '/proposal',
      '/contributions',
      '/projects-overview',
      '/proposal-template',
      '/final-reports',
    ],
  },
  {
    name: '$MOONEY',
    href: '/mooney',
    icon: CircleStackIcon,
    children: [
      { name: 'Get $MOONEY', href: '/get-mooney' },
      { name: 'Lock & vote', href: '/lock' },
      { name: 'Bridge', href: '/bridge' },
      { name: 'Governance', href: '/governance' },
    ],
    footerOnly: [
      { name: 'Governance Proposals', href: '/governance-proposals' },
      { name: 'Treasury', href: '/treasury' },
    ],
    ownedPaths: [
      '/mooney',
      '/get-mooney',
      '/lock',
      '/bridge',
      '/governance',
      '/governance-proposals',
      '/treasury',
    ],
  },
  {
    // The three campaigns used to hold a top-level slot each — a third of the
    // bar — at the same weight as the things the product is actually made of.
    // Grouping them here means a campaign starting or ending is an edit to one
    // array rather than a change to the shape of the whole nav.
    name: 'Missions',
    href: '/launch',
    icon: RocketLaunchIcon,
    children: [
      // `/frank` is only a redirect to `/mission/4` (see next.config.js), so
      // both of these address the mission page directly rather than paying for
      // a round trip through it.
      { name: 'Send Frank to Space', href: '/mission/4' },
      { name: 'Fly with Frank Leaderboard', href: '/mission/4?tab=leaderboard' },
      { name: 'Moon Base Zero', href: '/moonbase' },
      { name: 'DePrize', href: '/deprize' },
    ],
    footerOnly: [{ name: 'Path Forward Vote', href: '/overview-path-vote' }],
    ownedPaths: [
      '/launch',
      '/mission',
      '/moonbase',
      '/deprize',
      '/overview-path-vote',
      '/overview-vote',
    ],
  },
  {
    name: 'Learn',
    href: '/info',
    icon: FolderIcon,
    children: [
      { name: 'Documentation', href: '/docs' },
      { name: 'News & Updates', href: '/news' },
      { name: 'Town Hall', href: '/townhall' },
      { name: 'Roadmap', href: '/roadmap' },
      { name: 'Constitution', href: '/constitution' },
    ],
    footerOnly: [
      { name: 'Updates', href: '/updates' },
      { name: 'Press', href: '/press' },
      { name: 'Resources', href: '/resources' },
      { name: 'FAQ', href: '/faq' },
    ],
    ownedPaths: [
      '/info',
      '/docs',
      '/documentation',
      '/news',
      '/updates',
      '/press',
      '/townhall',
      '/roadmap',
      '/constitution',
      '/resources',
      '/faq',
    ],
  },
]

/**
 * Actions that belong to the signed-in user rather than to the site, shown in
 * the account menu behind the avatar alongside their teams and projects.
 */
export const ACCOUNT_ACTIONS: NavItem[] = [
  { name: 'Create a Team', href: '/team' },
  { name: 'Submit a Contribution', href: '/contributions' },
]

/** Strips the query string, so `/network?tab=teams` is owned by `/network`. */
function pathOf(href: string) {
  return href.split('?')[0]
}

/**
 * Whether `pathname` belongs to `group`. Prefix-matched so detail routes
 * (`/project/[id]`, `/citizen/[slug]`) light up their parent.
 *
 * `/` is excluded because every path starts with it.
 */
export function isGroupActive(group: NavGroup, pathname: string) {
  const owned = [
    pathOf(group.href),
    ...group.children.map((child) => pathOf(child.href)),
    ...(group.footerOnly ?? []).map((child) => pathOf(child.href)),
    ...(group.ownedPaths ?? []),
  ]

  return owned.some(
    (path) => path !== '/' && (pathname === path || pathname.startsWith(`${path}/`))
  )
}
