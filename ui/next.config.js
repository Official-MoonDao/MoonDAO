const nextTranslate = require('next-translate')
const result = require('dotenv').config()
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
  env: result.parsed,
})
