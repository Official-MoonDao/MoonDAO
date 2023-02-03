const nextTranslate = require('next-translate')
require('dotenv').config()
module.exports = nextTranslate({
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback.fs = false
      config.resolve.fallback.tls = false
      config.resolve.fallback.net = false
      config.resolve.fallback.child_process = false
    }
    return config
  },
  env: {
    GOOGLE_SHEETS_EMAIL: process.env.GOOGLE_SHEETS_EMAIL,
    GOOGLE_SHEETS_SECRET: process.env.GOOGLE_SHEETS_SECRET,
    GOOGLE_SPREADSHEET_ID: process.env.GOOGLE_SPREADSHEET_ID,
  },
})
