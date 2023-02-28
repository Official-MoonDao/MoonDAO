import Head from 'next/head'
import React from 'react'

export default function WebsiteHead({ title }: any) {
  const description = 'Decentralize space MoonDAO'
  const image = 'https://app.nation3.org/social.jpg'

  return (
    <Head>
      <title>MoonDAO | {title}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={`MoonDAO | ${title}`} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:type" content="website" />
      <meta name="twitter:title" content={`MoonDAO | ${title}`} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      <meta name="twitter:card" content="summary" />
    </Head>
  )
}
