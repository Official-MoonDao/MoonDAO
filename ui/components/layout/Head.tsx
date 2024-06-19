import Head from 'next/head'

const defaultTitle = "MoonDAO: The Internet's Space Program"
const defaultDescription =
  'Join MoonDAO and be part of the future of space exploration. Learn more about our mission and how you can get involved.'
const defaultImage = '/assets/MoonDAO-OG.png'

export default function WebsiteHead({
  title = defaultTitle,
  description = defaultDescription,
  image = defaultImage,
}: any) {
  return (
    <Head>
      <title key="meta-title">{`${title} | MoonDAO`}</title>
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
        content={`${title} | MoonDAO: The Internet's Space Program`}
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
        content={`${title} | MoonDAO: The Internet's Space Program`}
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
