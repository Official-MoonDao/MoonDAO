import Head from 'next/head'

const defaultDescription = "Let's decentralize access to space!"

export default function WebsiteHead({
  title,
  description = defaultDescription,
}: any) {
  const image =
    'https://global-uploads.webflow.com/634742417f9e1c182c6697d4/636290c53f8c0a618be80367_MoonDAO-OG.png'

  return (
    <Head>
      <title key="meta-title">{'MoonDAO | ' + title}</title>
      <link rel="icon" href="/favicon.ico" key="link-favicon" />
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
        property="og:url"
        content="https://app.moondao.com/"
        key="meta-ogurl"
      />
      <meta property="og:site_name" content="MoonDAO" key="meta-ogsitename" />
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
      <meta
        name="twitter:card"
        content="summary_large_image"
        key="meta-twcard"
      />
    </Head>
  )
}
