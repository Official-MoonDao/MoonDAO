import { DEPLOYED_ORIGIN } from 'const/config'
import type { GetServerSideProps } from 'next'
import Link from 'next/link'
import { SEED_ATLAS } from '@/lib/lunar-atlas'
import { baseRedis, readBaseById } from '@/lib/my-moonbase/baseStore'
import { DEFAULT_BASE_NAME, type MoonbaseLayout } from '@/lib/my-moonbase/grid'
import { readVisitorPicks, type VisitorPick } from '@/lib/my-moonbase/serverPicks'
import { baseSharePath, isBaseId, publicBaseName } from '@/lib/my-moonbase/share'
import { placeableAssetIds, sanitizeIncomingLayout } from '@/lib/my-moonbase/storedLayout'
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH, previewOrigin } from '@/lib/og/preview'
import Head from '@/components/layout/Head'
import MoonbaseVisit from '@/components/my-moonbase/MoonbaseVisit'

type Props = {
  base: { id: string; name: string; layout: MoonbaseLayout; updatedAt: number } | null
  picks: VisitorPick[] | null
  picksComplete: boolean
  /** Why there is no base to show. */
  missing: 'gone' | 'unavailable' | null
}

const DESCRIPTION =
  'A moonbase built from the hardware its builder predicts will win each race to the Moon. Look around, then build your own.'

export default function VisitMoonbasePage({ base, picks, picksComplete, missing }: Props) {
  if (!base) {
    return (
      <>
        <Head title="My Moonbase" description={DESCRIPTION} robots="noindex, follow" />
        <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className="text-2xl font-semibold text-white">
            {missing === 'unavailable' ? 'This base could not be loaded' : 'There is no base here'}
          </h1>
          <p className="max-w-md text-sm text-white/60">
            {missing === 'unavailable'
              ? 'Saved bases cannot be read right now. Reload in a minute to try again.'
              : 'The link may be mistyped, or the base may no longer exist.'}
          </p>
          <Link
            href="/moonbase/mine"
            className="rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:from-blue-500 hover:to-purple-500"
          >
            Build your own moonbase
          </Link>
        </div>
      </>
    )
  }

  const named = base.name !== DEFAULT_BASE_NAME
  return (
    <>
      <Head
        title={
          named
            ? `${base.name}: a moonbase built from predictions`
            : 'A moonbase built from predictions'
        }
        description={DESCRIPTION}
        image={`${previewOrigin()}/api/og/moonbase?id=${base.id}&v=${base.updatedAt}`}
        imageWidth={OG_IMAGE_WIDTH}
        imageHeight={OG_IMAGE_HEIGHT}
        canonical={`${DEPLOYED_ORIGIN}${baseSharePath(base.id)}`}
        // Reached by its link only, the way its builder shared it.
        robots="noindex, follow"
      />
      <MoonbaseVisit base={base} picks={picks} picksComplete={picksComplete} />
    </>
  )
}

const assetIds = placeableAssetIds(SEED_ATLAS)

export const getServerSideProps: GetServerSideProps<Props> = async ({ params, res }) => {
  const none = (missing: 'gone' | 'unavailable'): { props: Props } => {
    res.statusCode = missing === 'gone' ? 404 : 503
    return { props: { base: null, picks: null, picksComplete: false, missing } }
  }

  const id = params?.id
  if (!isBaseId(id)) return none('gone')
  const redis = baseRedis()
  if (!redis) return none('unavailable')

  let found: Awaited<ReturnType<typeof readBaseById>>
  try {
    found = await readBaseById(redis, id)
  } catch (err) {
    console.error('[my-moonbase] could not read a shared base', err)
    return none('unavailable')
  }
  const layout = found ? sanitizeIncomingLayout(found.base.layout, assetIds) : null
  if (!found || !layout) return none('gone')

  // The wallet stays on the server: a visitor gets what was predicted, not who by.
  const picks = await readVisitorPicks(redis, found.owner).catch(() => null)
  const name = publicBaseName(layout.name, process.env.TOUCHDOWN_NAME_BLOCKLIST)

  return {
    props: {
      base: { id, name, layout: { ...layout, name }, updatedAt: found.base.updatedAt },
      picks: picks?.picks ?? null,
      picksComplete: picks?.complete ?? false,
      missing: null,
    },
  }
}
