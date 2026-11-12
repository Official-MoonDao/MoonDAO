/**
 * Touchdown: a one-minute 3D Moon landing game.
 *
 * /touchdown is the public share link (it replaced the old campaign redirect to
 * the Touchdown prize page). /moonbase/touchdown re-exports this page so the
 * game also sits beside the Moon Base atlas, behind that section's launch gate.
 * The page is chromeless (see Layout): no site nav over the game.
 * The shell, Open Graph tags and fonts are server-rendered; the game canvas is
 * client-only.
 */
import { DEPLOYED_ORIGIN } from 'const/config'
import type { GetServerSideProps } from 'next'
import dynamic from 'next/dynamic'
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH, previewOrigin } from '@/lib/og/preview'
import { challengeQuery, parseChallenge, SHARE_PATH, type Challenge } from '@/lib/touchdown/share'
import Head from '@/components/layout/Head'

const TouchdownGame = dynamic(() => import('@/components/touchdown/TouchdownGame'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[100dvh] w-full items-center justify-center bg-black text-sm font-semibold tracking-widest text-white/60">
      BUILDING THE MOON…
    </div>
  ),
})

type Props = { challenge: Challenge | null }

export default function TouchdownPage({ challenge }: Props) {
  const score = challenge ? challenge.score.toLocaleString('en-US') : ''
  const title = challenge
    ? `Beat ${challenge.nickname ? `${challenge.nickname}'s ` : ''}${score} on Touchdown`
    : 'Touchdown: can you land on the Moon?'
  const description =
    'A one-minute 3D Moon landing game. Brake from orbit, dodge the boulders and set down soft, upright and on target. A new landing site at Moon Base Zero every day.'
  const ogQuery = challenge ? `?${challengeQuery(challenge)}` : ''
  return (
    <>
      <Head
        title={title}
        description={description}
        // A plain link previews with the staged scene as a static file; a
        // challenge link gets the same scene with the score to beat on it.
        image={
          challenge
            ? `${previewOrigin()}/api/og/touchdown${ogQuery}`
            : `${previewOrigin()}/touchdown/og.jpg`
        }
        imageWidth={OG_IMAGE_WIDTH}
        imageHeight={OG_IMAGE_HEIGHT}
        canonical={`${DEPLOYED_ORIGIN}${SHARE_PATH}`}
      />
      <TouchdownGame challenge={challenge} />
    </>
  )
}

export const getServerSideProps: GetServerSideProps<Props> = async ({ query }) => {
  const challenge = parseChallenge(query)
  // JSON props cannot carry `undefined`.
  return {
    props: {
      challenge: challenge ? { ...challenge, nickname: challenge.nickname ?? '' } : null,
    },
  }
}
