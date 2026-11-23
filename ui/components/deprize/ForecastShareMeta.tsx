import NextHead from 'next/head'
import { forecastOgImagePath, type ForecastSharePick } from '@/lib/forecasts/forecastShare'
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH, previewOrigin } from '@/lib/og/preview'

/**
 * Preview card for a shared forecast link. Render it after the page's own
 * <Head>: next/head keeps the last tag for each key.
 */
export default function ForecastShareMeta({ share }: { share: ForecastSharePick }) {
  const image = `${previewOrigin()}${forecastOgImagePath(share)}`
  const title = `My forecast: ${share.name}${
    share.raceName ? ` · ${share.raceName}` : ''
  } | MoonDAO`
  const alt = `Forecast card: ${share.name}${share.org ? ` by ${share.org}` : ''} for the ${
    share.race
  }`
  return (
    <NextHead>
      <meta property="og:title" content={title} key="meta-ogtitle" />
      <meta name="twitter:title" content={title} key="meta-twtitle" />
      <meta property="og:image" content={image} key="meta-ogimage" />
      <meta property="og:image:alt" content={alt} key="meta-ogimagealt" />
      <meta property="og:image:width" content={String(OG_IMAGE_WIDTH)} key="meta-ogimagewidth" />
      <meta property="og:image:height" content={String(OG_IMAGE_HEIGHT)} key="meta-ogimageheight" />
      <meta property="og:image:type" content="image/jpeg" key="meta-ogimagetype" />
      <meta name="twitter:image" content={image} key="meta-twimage" />
      <meta name="twitter:image:alt" content={alt} key="meta-twimagealt" />
    </NextHead>
  )
}
