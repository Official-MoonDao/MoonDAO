import { ChevronDownIcon, ChevronLeftIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { SEED_ATLAS } from '@/lib/lunar-atlas'
import { decorById } from '@/lib/my-moonbase/decor'
import {
  CELL_M,
  footprintCenterM,
  itemAt,
  sanitizeLayout,
  type Cell,
  type ItemKind,
  type PlacedItem,
} from '@/lib/my-moonbase/grid'
import { isPredictableRace } from '@/lib/my-moonbase/picks'
import type { VisitorPick } from '@/lib/my-moonbase/serverPicks'
import { baseCounts } from '@/lib/my-moonbase/share'
import { readStoredShareId } from '@/lib/my-moonbase/useMoonbaseSync'
import BuilderScene, { SceneFallback } from './LazyBuilderScene'
import { buildAssetCatalog, type AssetInfo, type CameraFocus } from './assets'

const NO_ITEMS: ReadonlySet<string> = new Set()

type Selected = { name: string; detail: string; dropped?: boolean }

export type VisitedBase = {
  id: string
  /** Already made safe to show: see `publicBaseName`. */
  name: string
  /** As saved. Checked again here against this browser's catalogue. */
  layout: unknown
}

/**
 * Someone else's base, to look around but not to change: the plot as they
 * left it, and the predictions it is built from.
 */
export default function MoonbaseVisit({
  base,
  picks,
  picksComplete,
}: {
  base: VisitedBase
  /** What the builder backs. Null when it could not be read. */
  picks: VisitorPick[] | null
  /** False when `picks` may be missing some, so nothing is shown as given up. */
  picksComplete: boolean
}) {
  const dataset = SEED_ATLAS
  const catalog = useMemo(() => buildAssetCatalog(dataset), [dataset])
  const assetInfo = useCallback((projectId: string) => catalog.get(projectId), [catalog])
  const spanFor = useCallback(
    (kind: ItemKind, ref: string) =>
      kind === 'asset' ? catalog.get(ref)?.span : decorById(ref)?.span,
    [catalog]
  )
  const layout = useMemo(() => sanitizeLayout(base.layout, spanFor), [base.layout, spanFor])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [focus, setFocus] = useState<CameraFocus | null>(null)
  const [listOpen, setListOpen] = useState(true)
  const [touch, setTouch] = useState(false)
  const [skipScene, setSkipScene] = useState(false)
  const [mine, setMine] = useState(false)

  useEffect(() => {
    try {
      setSkipScene(new URLSearchParams(window.location.search).has('noglobe'))
    } catch {
      /* ignore */
    }
    if (window.innerWidth < 640) setListOpen(false)
    setTouch(window.matchMedia('(pointer: coarse)').matches)
    setMine(readStoredShareId() === base.id)
  }, [base.id])

  // A fixed, fullscreen scene, as in the builder.
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const prevHtml = html.style.overflow
    const prevBody = body.style.overflow
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    return () => {
      html.style.overflow = prevHtml
      body.style.overflow = prevBody
    }
  }, [])

  const placed = useMemo(() => {
    const byRef = new Map<string, PlacedItem>()
    for (const item of layout.items) if (item.kind === 'asset') byRef.set(item.ref, item)
    return byRef
  }, [layout.items])

  // Hardware the builder has stopped backing stays as an empty lot, the way
  // they see it themselves. Only when every prediction was read: a partial
  // read must not empty lots that are still backed.
  const heldBackIds = useMemo(() => {
    if (!picks || !picksComplete) return NO_ITEMS
    const backed = new Set(picks.map((pick) => pick.projectId))
    const ids = new Set<string>()
    for (const item of layout.items) {
      if (item.kind === 'asset' && !backed.has(item.ref)) ids.add(item.id)
    }
    return ids
  }, [picks, picksComplete, layout.items])

  const races = useMemo(
    () =>
      dataset.sharedGoals.filter(isPredictableRace).map((goal) => ({
        goal,
        assets: (picks ?? [])
          .filter((pick) => pick.goalIds.includes(goal.id))
          .map((pick) => catalog.get(pick.projectId))
          .filter((asset): asset is AssetInfo => Boolean(asset)),
      })),
    [dataset.sharedGoals, picks, catalog]
  )
  const predicted = races.filter((race) => race.assets.length > 0)
  const open = races.filter((race) => race.assets.length === 0)

  const flyTo = (item: PlacedItem) => {
    const centre = footprintCenterM(item.x, item.z, item.span)
    setSelectedId(item.id)
    setFocus((prev) => ({
      xM: centre.x,
      zM: centre.z,
      distM: Math.min(170, Math.max(40, item.span * CELL_M * 2 + 30)),
      nonce: (prev?.nonce ?? 0) + 1,
    }))
    if (window.innerWidth < 640) setListOpen(false)
  }

  const selectedItem = selectedId ? layout.items.find((item) => item.id === selectedId) : undefined
  const selected = useMemo<Selected | null>(() => {
    if (!selectedItem) return null
    if (selectedItem.kind === 'decor') {
      return { name: decorById(selectedItem.ref)?.label ?? 'Scenery', detail: 'Scenery' }
    }
    const info = catalog.get(selectedItem.ref)
    if (heldBackIds.has(selectedItem.id)) {
      return {
        name: info?.project.name ?? selectedItem.ref,
        detail: 'An empty lot. The builder no longer predicts this one.',
        dropped: true,
      }
    }
    const inRaces = races
      .filter((race) => race.assets.some((asset) => asset.project.id === selectedItem.ref))
      .map((race) => race.goal.title)
    return {
      name: info?.project.name ?? selectedItem.ref,
      detail: [info?.orgName, inRaces.length ? `Predicted to win: ${inRaces.join(', ')}` : '']
        .filter(Boolean)
        .join(' · '),
    }
  }, [selectedItem, catalog, heldBackIds, races])

  const counts = baseCounts(layout)
  const hint = touch
    ? 'Drag to move around · two fingers to turn and zoom · tap hardware to name it'
    : 'Drag to move around · right-drag to turn · scroll to zoom · click hardware to name it'

  return (
    <div className="relative h-[calc(100vh-4rem)] w-full overflow-hidden bg-black">
      <div
        className="absolute inset-0"
        role="region"
        aria-label={`${base.name}, a 3D moonbase built from predictions`}
      >
        {skipScene ? (
          <SceneFallback />
        ) : (
          <BuilderScene
            layout={layout}
            tool="select"
            pending={null}
            roadStart={null}
            selectedId={selectedId}
            heldBackIds={heldBackIds}
            assetInfo={assetInfo}
            focus={focus}
            onCellClick={(cell: Cell) => setSelectedId(itemAt(layout, cell)?.id ?? null)}
            onItemClick={setSelectedId}
            onBackgroundClick={() => setSelectedId(null)}
          />
        )}
      </div>

      <div className="pointer-events-none absolute inset-0 flex flex-col">
        <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-5">
          <div className="flex min-h-0 w-full flex-col gap-3 sm:w-80">
            <div className="pointer-events-auto shrink-0 rounded-2xl border border-white/10 bg-black/50 px-4 py-3 backdrop-blur-md">
              <Link
                href="/moonbase"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-300 hover:text-cyan-200"
              >
                <ChevronLeftIcon className="h-3 w-3" />
                Moon Base Zero
              </Link>
              <h1 className="mt-0.5 truncate text-lg font-semibold text-white">{base.name}</h1>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-white/50">
                  {counts.assets} {counts.assets === 1 ? 'asset' : 'assets'} · {counts.scenery}{' '}
                  scenery · {counts.roads} road
                </p>
                <button
                  type="button"
                  onClick={() => setListOpen((value) => !value)}
                  aria-expanded={listOpen}
                  className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-white/60 hover:bg-white/10 hover:text-white"
                >
                  Predictions
                  {listOpen ? (
                    <ChevronUpIcon className="h-3 w-3" />
                  ) : (
                    <ChevronDownIcon className="h-3 w-3" />
                  )}
                </button>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-white/55">
                {mine
                  ? 'This is your base, as visitors see it.'
                  : 'Someone built this from the hardware they predict will win each race to the Moon.'}
              </p>
              <Link
                href="/moonbase/mine"
                className="mt-2 block rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-3 py-2 text-center text-xs font-semibold text-white transition hover:from-blue-500 hover:to-purple-500"
              >
                {mine ? 'Edit your base' : 'Build your own'}
              </Link>
            </div>

            {listOpen && (
              <div className="pointer-events-auto flex max-h-[38vh] min-h-0 flex-col rounded-2xl border border-white/10 bg-black/50 backdrop-blur-md sm:max-h-none">
                <div className="flex items-baseline justify-between gap-3 px-4 pt-3">
                  <h2 className="text-sm font-semibold text-white">
                    {mine ? 'Your predictions' : 'Their predictions'}
                  </h2>
                  {picks && (
                    <span className="text-[11px] text-white/45">
                      {predicted.length} of {races.length} races
                    </span>
                  )}
                </div>
                {!picks && (
                  <p className="px-4 pb-3 pt-2 text-xs text-amber-200/90">
                    Their predictions could not be read just now. The base is shown as it was saved.
                    Reload to try again.
                  </p>
                )}
                {picks && !picksComplete && (
                  <p className="px-4 pt-2 text-[11px] text-amber-200/90">
                    Some predictions could not be read, so this list may be missing hardware.
                  </p>
                )}
                {picks && predicted.length === 0 && (
                  <p className="px-4 pb-3 pt-2 text-xs text-white/60">
                    No predictions yet. This base is scenery and roads so far.
                  </p>
                )}
                {picks && (
                  <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-2 pb-3 pt-2">
                    {predicted.map(({ goal, assets }) => (
                      <section key={goal.id}>
                        <h3 className="truncate px-2 text-[10px] font-semibold uppercase tracking-wide text-white/40">
                          {goal.title}
                        </h3>
                        <ul className="mt-1 space-y-1">
                          {assets.map((asset) => {
                            const item = placed.get(asset.project.id)
                            return (
                              <li
                                key={asset.project.id}
                                className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5"
                              >
                                <span
                                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                                  style={{ backgroundColor: asset.accent }}
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-xs font-medium text-white">
                                    {asset.project.name}
                                  </span>
                                  <span className="block truncate text-[11px] text-white/45">
                                    {asset.orgName}
                                  </span>
                                </span>
                                {item ? (
                                  <button
                                    type="button"
                                    onClick={() => flyTo(item)}
                                    className="shrink-0 rounded-md border border-white/10 px-2 py-1 text-[11px] font-medium text-white/70 transition hover:border-white/30 hover:text-white"
                                  >
                                    Find
                                  </button>
                                ) : (
                                  <span className="shrink-0 text-[11px] text-white/35">
                                    Not placed
                                  </span>
                                )}
                              </li>
                            )
                          })}
                        </ul>
                      </section>
                    ))}
                    {open.length > 0 && predicted.length > 0 && (
                      <section>
                        <h3 className="px-2 text-[10px] font-semibold uppercase tracking-wide text-white/40">
                          Not predicted yet
                        </h3>
                        <ul className="mt-1">
                          {open.map(({ goal }) => (
                            <li key={goal.id} className="truncate px-2 py-1 text-xs text-white/45">
                              {goal.title}
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}
                    {heldBackIds.size > 0 && (
                      <p className="px-2 text-[11px] leading-relaxed text-white/45">
                        Amber lots mark hardware the builder placed and has since stopped
                        predicting.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-center px-3 pb-4 sm:pb-5">
          {selected ? (
            <div className="pointer-events-auto max-w-full rounded-xl border border-cyan-300/25 bg-black/70 px-3 py-2 backdrop-blur-md">
              <p className="truncate text-sm font-semibold text-white">{selected.name}</p>
              {selected.detail && (
                <p
                  className={`text-[11px] ${
                    selected.dropped ? 'text-amber-200/90' : 'text-white/50'
                  }`}
                >
                  {selected.detail}
                </p>
              )}
            </div>
          ) : (
            <p className="rounded-full bg-black/50 px-3 py-1 text-center text-[11px] text-white/55 backdrop-blur-md">
              {hint}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
