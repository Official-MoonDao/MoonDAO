const nextTranslate = require('next-translate')
module.exports = nextTranslate({
  reactStrictMode: true,
  images: {
    domains: ['cdn.shopify.com'],
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
