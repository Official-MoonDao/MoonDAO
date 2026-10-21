module.exports = {
  siteUrl: 'https://moondao.com',
  generateRobotsTxt: true, // Set to generate robots.txt
  // Quarterly contribution reports (pages/contributions/[cycle]) are noindex.
  exclude: ['/contributions/*'],
  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        disallow: '',
      },
    ],
  },
}
