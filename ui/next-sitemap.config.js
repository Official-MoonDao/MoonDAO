module.exports = {
  siteUrl: 'moondao.com', // Replace with your site URL
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
