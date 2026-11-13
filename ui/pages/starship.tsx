/**
 * Starship Catch: a one-minute 3D game. Guide a Starship upper stage into the launch
 * tower's arms at Starbase.
 *
 * /starship is the public share link (/catch redirects here). The page is chromeless like /touchdown (see
 * Layout): no site nav over the game. The shell, Open Graph tags and fonts are
 * server-rendered; the game canvas is client-only.
 */
import { DEPLOYED_ORIGIN } from 'const/config'
import type { GetServerSideProps } from 'next'
import dynamic from 'next/dynamic'
import { challengeQuery, parseChallenge, SHARE_PATH, type Challenge } from '@/lib/catch/share'
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH, previewOrigin } from '@/lib/og/preview'
import Head from '@/components/layout/Head'

const CatchGame = dynamic(() => import('@/components/catch/CatchGame'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[100dvh] w-full items-center justify-center bg-black text-sm font-semibold tracking-widest text-white/60">
      ROLLING OUT TO THE PAD…
    </div>
  ),
})

type Props = { challenge: Challenge | null }

export default function CatchPage({ challenge }: Props) {
  const score = challenge ? challenge.score.toLocaleString('en-US') : ''
  const title = challenge ? `Beat ${challenge.nickname ? `${challenge.nickname}'s ` : ''}${score} on Starship Catch` : 'Starship Catch: can you catch a Starship?'
  const description =
    'A one-minute 3D game. A Starship falls out of the sky over Starbase: brake, steer, and set it down in the launch tower’s arms. New weather every day.'
  const ogQuery = challenge ? `?${challengeQuery(challenge)}` : ''
  return (
    <>
      <Head
        title={title}
        description={description}
        // A plain link previews with the staged scene as a static file; a
        // challenge link gets the same scene with the score to beat on it.
        image={challenge ? `${previewOrigin()}/api/og/catch${ogQuery}` : `${previewOrigin()}/catch/og.jpg`}
        imageWidth={OG_IMAGE_WIDTH}
        imageHeight={OG_IMAGE_HEIGHT}
        canonical={`${DEPLOYED_ORIGIN}${SHARE_PATH}`}
      />
      <CatchGame challenge={challenge} />
    </>
  )
}

export const getServerSideProps: GetServerSideProps<Props> = async ({ query }) => {
  const challenge = parseChallenge(query)
  // JSON props cannot carry `undefined`.
  return { props: { challenge: challenge ? { ...challenge, nickname: challenge.nickname ?? '' } : null } }
}
