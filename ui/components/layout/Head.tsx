import Head from 'next/head'

export default function WebsiteHead({ title }: any) {
  const description = 'Decentralize space MoonDAO'
  const image = 'https://app.nation3.org/social.jpg'

  return (
    <Head>
      <title key="meta-title">MoonDAO | {title}</title>
      <meta
        name="viewport"
        content="width=device-width, initial-scale=1"
        key="meta-viewport"
      />
      <meta charSet="utf-8" key="charSet" />
      <meta name="description" content={description} key="meta-desc" />
      <meta
        property="og:title"
        content={`MoonDAO | ${title}`}
        key="meta-ogtitle"
      />
      <meta property="og:description" content={description} key="meta-ogdesc" />
      <meta property="og:image" content={image} key="meta-ogimage" />
      <meta property="og:type" content="website" key="meta-ogweb" />
      <meta
        name="twitter:title"
        content={`MoonDAO | ${title}`}
        key="meta-twtitle"
      />
      <meta
        name="twitter:description"
        content={description}
        key="meta-twdesc"
      />
      <meta name="twitter:image" content={image} key="meta-twimage" />
      <meta name="twitter:card" content="summary" key="meta-twcard" />
    </Head>
  )
}
