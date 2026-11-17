/**
 * Lunar Rover: First Tracks. A short 3D game: drive a commercial lunar rover
 * off its lander and across the day's landing site, through real Earth-Moon
 * signal delay.
 *
 * /rover is the public share link (/first-tracks redirects here). The page is
 * chromeless like /touchdown and /starship (see Layout): no site nav over the
 * game. The shell, Open Graph tags and fonts are server-rendered; the game
 * canvas is client-only.
 */
import { DEPLOYED_ORIGIN } from 'const/config'
import type { GetServerSideProps } from 'next'
import dynamic from 'next/dynamic'
import { challengeQuery, parseChallenge, SHARE_PATH, type Challenge } from '@/lib/first-tracks/share'
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH, previewOrigin } from '@/lib/og/preview'
import Head from '@/components/layout/Head'

const FirstTracksGame = dynamic(() => import('@/components/first-tracks/FirstTracksGame'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[100dvh] w-full items-center justify-center bg-black text-sm font-semibold tracking-widest text-white/60">
      UNPACKING THE ROVER…
    </div>
  ),
})

type Props = { challenge: Challenge | null }

export default function FirstTracksPage({ challenge }: Props) {
  const score = challenge ? challenge.score.toLocaleString('en-US') : ''
  const title = challenge ? `Beat ${challenge.nickname ? `${challenge.nickname}'s ` : ''}${score} on Lunar Rover: First Tracks` : 'Lunar Rover: First Tracks. Can you drive on the Moon?'
  const description =
    'A 3D rover game. Drive a commercial rover off its lander and across the Moon through real signal delay: every command arrives late and every picture is old. New landing site every day.'
  const ogQuery = challenge ? `?${challengeQuery(challenge)}` : ''
  return (
    <>
      <Head
        title={title}
        description={description}
        // A plain link previews with the staged scene as a static file; a
        // challenge link gets the same scene with the score to beat on it.
        image={challenge ? `${previewOrigin()}/api/og/first-tracks${ogQuery}` : `${previewOrigin()}/first-tracks/og.jpg`}
        imageWidth={OG_IMAGE_WIDTH}
        imageHeight={OG_IMAGE_HEIGHT}
        canonical={`${DEPLOYED_ORIGIN}${SHARE_PATH}`}
      />
      <FirstTracksGame challenge={challenge} />
    </>
  )
}

export const getServerSideProps: GetServerSideProps<Props> = async ({ query }) => {
  const challenge = parseChallenge(query)
  // JSON props cannot carry `undefined`.
  return { props: { challenge: challenge ? { ...challenge, nickname: challenge.nickname ?? '' } : null } }
}
