// Page Metadata
import Head from 'next/head'

const defaultTitle = "MoonDAO: The Internet's Space Program"
const defaultDescription =
  'Join MoonDAO and be part of the future of space exploration. Learn more about our mission and how you can get involved.'
const defaultImage =
  'https://ipfs.io/ipfs/QmXY1axN4tQGV7CQBFtoE4hMZM3TRGMqqg5DD5LG3dz1dA'

type WebsiteHeadProps = {
  title?: string
  secondaryTitle?: string
  description?: string
  image?: string
  children?: any
}

export default function WebsiteHead({
  title = defaultTitle,
  secondaryTitle,
  description = defaultDescription,
  image = defaultImage,
  children,
}: WebsiteHeadProps) {
  const truncatedDescription =
    description.length > 160
      ? description.substring(0, 160) + '...'
      : description

  return (
    <Head>
      <title key="meta-title">{`${title} | ${
        secondaryTitle || 'MoonDAO'
      }`}</title>
      <link rel="icon" href="/favicon.ico" key="link-favicon" />
      <meta
        name="viewport"
        content="width=device-width, initial-scale=1"
        key="meta-viewport"
      />
      <meta charSet="utf-8" key="charSet" />
      <meta name="description" content={truncatedDescription} key="meta-desc" />
      <meta
        property="og:title"
        content={`${title} | ${
          secondaryTitle || "MoonDAO: The Internet's Space Program"
        }`}
        key="meta-ogtitle"
      />
      <meta
        property="og:description"
        content={truncatedDescription}
        key="meta-ogdesc"
      />
      <meta property="og:image" content={image} key="meta-ogimage" />
      <meta property="og:type" content="website" key="meta-ogweb" />
      <meta property="og:url" content="https://moondao.com/" key="meta-ogurl" />
      <meta property="og:site_name" content="MoonDAO" key="meta-ogsitename" />
      <meta
        name="twitter:title"
        content={`${title} | ${
          secondaryTitle || "MoonDAO: The Internet's Space Program"
        }`}
        key="meta-twtitle"
      />
      <meta
        name="twitter:description"
        content={truncatedDescription}
        key="meta-twdesc"
      />
      <meta name="twitter:image" content={image} key="meta-twimage" />
      <meta
        name="twitter:card"
        content="summary_large_image"
        key="meta-twcard"
      />
      {children}
    </Head>
  )
}
