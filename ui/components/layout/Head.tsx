import Head from 'next/head'

const defaultDescription = "Let's decentralize access to space!"

export default function WebsiteHead({
  title,
  description = defaultDescription,
}: any) {
  const image = 'ipfs://QmVyGXVwnWUSCFY2vtYpcVryVyDdLKx4Wi7k57dSoo9Bpf'

  return (
    <Head>
      <title key="meta-title">{'Mission Control | ' + title}</title>
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
        content={`Mission Control | ${title}`}
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
        content={`Mission Control | ${title}`}
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
