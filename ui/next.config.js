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
    ],
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
