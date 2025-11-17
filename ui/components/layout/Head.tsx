// Page Metadata
import { DEPLOYED_ORIGIN } from 'const/config'
import Head from 'next/head'
import { useRouter } from 'next/router'

const defaultTitle = "MoonDAO: The Internet's Space Program"
const defaultDescription =
  'Join MoonDAO and be part of the future of space exploration. Learn more about our mission and how you can get involved.'
const defaultImage = 'https://ipfs.io/ipfs/QmXY1axN4tQGV7CQBFtoE4hMZM3TRGMqqg5DD5LG3dz1dA'

type WebsiteHeadProps = {
  title?: string
  secondaryTitle?: string
  description?: string
  image?: string
  keywords?: string
  author?: string
  robots?: string
  children?: any
}

export default function WebsiteHead({
  title = defaultTitle,
  secondaryTitle,
  description = defaultDescription,
  image = defaultImage,
  keywords,
  author = 'MoonDAO',
  robots = 'index, follow',
  children,
}: WebsiteHeadProps) {
  const router = useRouter()
  const canonicalUrl = `${DEPLOYED_ORIGIN}${router.asPath}`

  const truncatedDescription =
    description.length > 160 ? description.substring(0, 160) + '...' : description

  const fullTitle = `${title} | ${secondaryTitle || 'MoonDAO'}`

  const defaultKeywords =
    "MoonDAO, Nasa, web3, space, space exploration, lunar settlement, the internet's space program, decentralized space program"

  return (
    <Head>
      <title key="meta-title">{fullTitle}</title>
      <link rel="icon" href="/favicon.ico" key="link-favicon" />
      <meta name="viewport" content="width=device-width, initial-scale=1" key="meta-viewport" />
      <meta charSet="utf-8" key="charSet" />
      <meta name="description" content={truncatedDescription} key="meta-desc" />
      <meta name="author" content={author} key="meta-author" />
      <meta name="robots" content={robots} key="meta-robots" />

      <meta
        name="keywords"
        content={`${keywords ? `${keywords}, ${defaultKeywords}` : defaultKeywords}`}
        key="meta-keywords"
      />

      {canonicalUrl && <link rel="canonical" href={canonicalUrl} key="link-canonical" />}

      {/* Open Graph / Facebook */}
      <meta
        property="og:title"
        content={`${title} | ${secondaryTitle || "MoonDAO: The Internet's Space Program"}`}
        key="meta-ogtitle"
      />
      <meta property="og:description" content={truncatedDescription} key="meta-ogdesc" />
      <meta property="og:image" content={image} key="meta-ogimage" />
      <meta property="og:image:alt" content={title} key="meta-ogimagealt" />
      <meta property="og:type" content="website" key="meta-ogweb" />
      <meta property="og:url" content={canonicalUrl || 'https://moondao.com/'} key="meta-ogurl" />
      <meta property="og:site_name" content="MoonDAO" key="meta-ogsitename" />
      <meta property="og:locale" content="en_US" key="meta-oglocale" />

      {/* Twitter */}
      <meta
        name="twitter:title"
        content={`${title} | ${secondaryTitle || "MoonDAO: The Internet's Space Program"}`}
        key="meta-twtitle"
      />
      <meta name="twitter:description" content={truncatedDescription} key="meta-twdesc" />
      <meta name="twitter:image" content={image} key="meta-twimage" />
      <meta name="twitter:image:alt" content={title} key="meta-twimagealt" />
      <meta name="twitter:card" content="summary_large_image" key="meta-twcard" />
      <meta name="twitter:site" content="@OfficialMoonDAO" key="meta-twsite" />
      <meta name="twitter:creator" content="@OfficialMoonDAO" key="meta-twcreator" />

      {/* Additional SEO enhancements */}
      <meta name="theme-color" content="#090D21" key="meta-theme" />
      <link rel="apple-touch-icon" href="/apple-touch-icon.png" key="link-apple" />

      {children}
    </Head>
  )
}
