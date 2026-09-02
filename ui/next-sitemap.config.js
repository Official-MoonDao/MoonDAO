module.exports = {
  siteUrl: 'https://moondao.com',
  generateRobotsTxt: true, // Set to generate robots.txt
  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        disallow: '',
      },
    ],
  },
}
