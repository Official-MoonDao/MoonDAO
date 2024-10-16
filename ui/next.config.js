const nextTranslate = require('next-translate')
module.exports = nextTranslate({
  reactStrictMode: true,
  images: {
    domains: [
      'cdn.shopify.com',
      'cryptologos.cc',
      'gateway.ipfscdn.io',
      'ipfs.cf-ipfs.com',
      'ipfscdn.io',
      'b507f59d2508ebfb5e70996008095782.ipfscdn.io',
      'r2.comfy.icu',
      'cdn.discordapp.com',
      'cdn.stamp.fyi',
    ],
  },
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'app.moondao.com',
          },
        ],
        destination: 'https://moondao.com/:path*',
        permanent: true,
      },
      {
        source: '/docs',
        destination: 'https://docs.moondao.com/',
        permanent: true,
      },
      {
        source: '/docs/introduction',
        destination: 'https://docs.moondao.com/',
        permanent: true,
      },
      {
        source: '/docs/constitution',
        destination: 'https://docs.moondao.com/Governance/Constitution',
        permanent: true,
      },
      {
        source: '/docs/token',
        destination: 'https://docs.moondao.com/Governance/Governance-Tokens',
        permanent: true,
      },
      {
        source: '/docs/faq',
        destination: 'https://docs.moondao.com/About/FAQ',
        permanent: true,
      },
      {
        source: '/docs/launch-path',
        destination: 'https://docs.moondao.com/launch-path',
        permanent: true,
      },
      {
        source: '/docs/team',
        destination: 'https://docs.moondao.com/About/Team',
        permanent: true,
      },
      {
        source: '/docs/contribute',
        destination: 'https://docs.moondao.com/Onboarding/Contribute',
        permanent: true,
      },
      {
        source: '/docs/project-guidelines',
        destination: 'https://docs.moondao.com/Projects/Project-System',
        permanent: true,
      },
      {
        source: '/docs/ticket-to-space-sweepstakes-rules',
        destination:
          'https://docs.moondao.com/Legal/Ticket-to-Space-NFT/Ticket-to-Space-Sweepstakes-Rules',
        permanent: true,
      },
      {
        source: '/docs/ticket-to-space-NFT-FAQs',
        destination:
          'https://docs.moondao.com/Legal/Ticket-to-Space-NFT/Ticket-to-Space-Sweepstakes-Rules',
        permanent: true,
      },
      {
        source: '/docs/dispute-notice',
        destination:
          'https://docs.moondao.com/Legal/Ticket-to-Space-NFT/Dispute-Notice',
        permanent: true,
      },
      {
        source: '/docs/nft-owner-agreement',
        destination:
          'https://docs.moondao.com/Legal/Ticket-to-Space-NFT/Ticket-to-Space-NFT-Owner-Agreement',
        permanent: true,
      },
      {
        source: '/docs/website-terms-and-conditions',
        destination:
          'https://docs.moondao.com/Legal/Website-Terms-and-Conditions',
        permanent: true,
      },
      {
        source: '/docs/sweepstakes-and-securities-disclaimer',
        destination:
          'https://docs.moondao.com/Legal/Ticket-to-Space-NFT/Sweepstakes-and-Securities-Disclaimer',
        permanent: true,
      },
      {
        source: '/docs/privacy-policy',
        destination: 'https://docs.moondao.com/Legal/Website-Privacy-Policy',
        permanent: true,
      },
      {
        source: '/thank-you-explorer-almost-there',
        destination: '/almost-there',
        permanent: true,
      },
      {
        source: '/twitter',
        destination: 'https://twitter.com/OfficialMoonDAO',
        permanent: true,
      },
      {
        source: '/instagram',
        destination: 'https://www.instagram.com/official_moondao/',
        permanent: true,
      },
      {
        source: '/discord',
        destination: 'https://discord.gg/moondao',
        permanent: true,
      },
      {
        source: '/zero-g',
        destination: '/zero-gravity',
        permanent: true,
      },
      {
        source: '/zero-g-sweepstakes',
        destination: '/zero-gravity',
        permanent: true,
      },
      {
        source: '/zero-g-contest',
        destination: '/zero-gravity',
        permanent: true,
      },
      {
        source: '/contribute',
        destination: 'https://discord.gg/moondao',
        permanent: true,
      },
      {
        source: '/es',
        destination: '/',
        permanent: true,
      },
      {
        source: '/zh-cn',
        destination: '/',
        permanent: true,
      },
      {
        source: '/zh-Hant',
        destination: '/',
        permanent: true,
      },
      {
        source: '/old-home-3',
        destination: '/',
        permanent: true,
      },
      {
        source: '/dude-perfect-second-astronaut-selection',
        destination: '/dude-perfect',
        permanent: true,
      },
      {
        source: '/follow-moondao',
        destination: '/linktree',
        permanent: true,
      },
      {
        source: '/waitlist',
        destination: '/join-us',
        permanent: true,
      },
    ]
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback.fs = false
      config.resolve.fallback.tls = false
      config.resolve.fallback.net = false
      config.resolve.fallback.child_process = false
    }
    return config
  },
})
