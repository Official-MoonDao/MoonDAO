module.exports = {
  siteUrl: 'https://moondao.com',
  generateRobotsTxt: true, // Set to generate robots.txt
  // Quarterly contribution reports (public/contributions/*.html) are noindex.
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
