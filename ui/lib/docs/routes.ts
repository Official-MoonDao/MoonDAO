import { docsHref } from './slug'

/**
 * App routes that used to iframe a single Quartz page. Each still exists so
 * existing bookmarks, nav items, and Privy legal URLs keep working; they now
 * render the native docs page for `slug`.
 */
export const SHORT_DOC_ROUTES: Record<string, string> = {
  '/about': 'index',
  '/faq': 'About/FAQ',
  '/constitution': 'Governance/Constitution',
  '/privacy-policy': 'Legal/Website-Privacy-Policy',
  '/terms-of-service': 'Legal/Website-Terms-and-Conditions',
  '/project-system-docs': 'Projects/Project-System',
}

/** Legacy pre-Quartz `/docs/<short-name>` paths. Kept as next.config.js redirects. */
export const LEGACY_DOC_REDIRECTS: { source: string; destination: string }[] = [
  { source: '/docs/introduction', destination: '/docs' },
  { source: '/docs/token', destination: docsHref('Governance/Governance-Tokens') },
  { source: '/docs/launch-path', destination: '/docs' },
  { source: '/docs/team', destination: docsHref('About/Team') },
  { source: '/docs/contribute', destination: docsHref('Onboarding/Contribute') },
  { source: '/docs/project-guidelines', destination: docsHref('Projects/Project-System') },
  {
    source: '/docs/ticket-to-space-sweepstakes-rules',
    destination: docsHref('Legal/Ticket-to-Space-NFT/Ticket-to-Space-Sweepstakes-Rules'),
  },
  {
    source: '/docs/ticket-to-space-NFT-FAQs',
    destination: docsHref('Legal/Ticket-to-Space-NFT/Ticket-to-Space-Sweepstakes-Rules'),
  },
  {
    source: '/docs/dispute-notice',
    destination: docsHref('Legal/Ticket-to-Space-NFT/Dispute-Notice'),
  },
  {
    source: '/docs/nft-owner-agreement',
    destination: docsHref('Legal/Ticket-to-Space-NFT/Ticket-to-Space-NFT-Owner-Agreement'),
  },
  {
    source: '/docs/sweepstakes-and-securities-disclaimer',
    destination: docsHref('Legal/Ticket-to-Space-NFT/Sweepstakes-and-Securities-Disclaimer'),
  },
]
