module.exports = {
  siteUrl: 'https://moondao.com',
  generateRobotsTxt: true, // Set to generate robots.txt
  // Quarterly contribution reports (pages/contributions/[cycle]) are noindex.
  // The Sepolia DePrize registry and the play harness stay password-gated
  // after launch (ALWAYS_GATED_PREFIXES in lib/gate/access.ts).
  exclude: [
    '/contributions/*',
    '/deprize/sep',
    '/deprize/sep/*',
    '/deprize-play',
    '/deprize-play/*',
    '/gate',
  ],
  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        disallow: '',
      },
    ],
  },
}
