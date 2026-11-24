import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronUpIcon,
  ShareIcon,
} from '@heroicons/react/24/outline'
import { getAccessToken, useLogin } from '@privy-io/react-auth'
import Link from 'next/link'
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { SEED_ATLAS } from '@/lib/lunar-atlas'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import { decorById } from '@/lib/my-moonbase/decor'
import {
  CELL_M,
  DEFAULT_BASE_NAME,
  MAX_ITEMS,
  MAX_NAME_LENGTH,
  addRoads,
  canPlace,
  emptyLayout,
  footprintAnchor,
  footprintCenterM,
  hasRoad,
  itemAt,
  moveItem,
  nextRot,
  placeItem,
  removeItem,
  removeRoad,
  renameBase,
  roadPath,
  setItemRot,
  type Cell,
  type ItemKind,
  type PlacedItem,
} from '@/lib/my-moonbase/grid'
import { useMoonbaseLayout } from '@/lib/my-moonbase/useMoonbaseLayout'
import { useMoonbasePicks } from '@/lib/my-moonbase/useMoonbasePicks'
import { useMoonbaseSync } from '@/lib/my-moonbase/useMoonbaseSync'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import ForecastPredictModal from '@/components/deprize/ForecastPredictModal'
import BuildBar, { type SelectedSummary } from './BuildBar'
import type { FrameCapture } from './BuilderScene'
import InventoryPanel, { type InventoryRace } from './InventoryPanel'
import BuilderScene, { SceneFallback } from './LazyBuilderScene'
import ShareBaseModal from './ShareBaseModal'
import {
  buildAssetCatalog,
  type AssetInfo,
  type BuilderTool,
  type CameraFocus,
  type PendingPlacement,
} from './assets'

const TOAST_ID = 'my-moonbase'

function newItemId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el?.tagName) return false
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable
}

export default function MyMoonbase() {
  const dataset = SEED_ATLAS
  const { selectedChain: chain } = useContext(ChainContextV5)
  const { login } = useLogin()

  const catalog = useMemo(() => buildAssetCatalog(dataset), [dataset])
  const assetInfo = useCallback((projectId: string) => catalog.get(projectId), [catalog])
  const spanFor = useCallback(
    (kind: ItemKind, ref: string) =>
      kind === 'asset' ? catalog.get(ref)?.span : decorById(ref)?.span,
    [catalog]
  )

  const chainSlug = getChainSlug(chain)
  const nameOf = useCallback((projectId: string) => catalog.get(projectId)?.project.name, [catalog])
  const {
    status,
    picks,
    betsPending,
    races: predictRaces,
    market,
    address,
    identityReady,
    refresh,
  } = useMoonbasePicks(chain, dataset.sharedGoals, nameOf)
  const { layout, loaded, saveFailed, edit, replace, undo, redo, canUndo, canRedo } =
    useMoonbaseLayout(spanFor)
  const sync = useMoonbaseSync({
    layout,
    loaded,
    address,
    identityReady,
    getToken: getAccessToken,
    spanFor,
    replace,
  })
  const [sharing, setSharing] = useState(false)
  const captureRef = useRef<FrameCapture | null>(null)
  const capture = useCallback(() => captureRef.current?.() ?? null, [])

  const [tool, setTool] = useState<BuilderTool>('select')
  const [pending, setPending] = useState<PendingPlacement | null>(null)
  const [roadStart, setRoadStart] = useState<Cell | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [focus, setFocus] = useState<CameraFocus | null>(null)
  const [inventoryOpen, setInventoryOpen] = useState(true)
  const [touch, setTouch] = useState(false)
  // Headless browsers have no usable WebGL. `?noglobe=1` keeps the panels
  // testable there, the same switch Moon Base Zero honours.
  const [skipScene, setSkipScene] = useState(false)

  useEffect(() => {
    try {
      setSkipScene(new URLSearchParams(window.location.search).has('noglobe'))
    } catch {
      /* ignore */
    }
    // A phone has no room for the list and the plot at once.
    if (window.innerWidth < 640) setInventoryOpen(false)
    setTouch(window.matchMedia('(pointer: coarse)').matches)
  }, [])

  // A fixed, fullscreen scene. The shared Layout makes the document taller
  // than the viewport, so lock its scroll while this page is mounted.
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

  const unlocked = useMemo(() => new Set(picks.map((pick) => pick.projectId)), [picks])

  const races = useMemo<InventoryRace[]>(() => {
    const goals = new Map(dataset.sharedGoals.map((goal) => [goal.id, goal]))
    return predictRaces.flatMap((race) => {
      const goal = goals.get(race.goalId)
      if (!goal) return []
      const field = race.outcomeIds.flatMap((projectId, index) => {
        const asset = projectId ? catalog.get(projectId) : undefined
        return asset ? [{ index, asset }] : []
      })
      const closedReason =
        market?.goalId !== race.goalId
          ? undefined
          : market.resolved
          ? 'This race has been decided, so predictions are closed.'
          : market.payoutPending
          ? 'Checking the prize market…'
          : undefined
      return [
        {
          goal,
          assets: picks
            .filter((pick) => pick.goalIds.includes(goal.id))
            .map((pick) => catalog.get(pick.projectId))
            .filter((asset): asset is AssetInfo => Boolean(asset)),
          field,
          closedReason,
        },
      ]
    })
  }, [dataset.sharedGoals, predictRaces, market, picks, catalog])

  // The race whose predict window is mounted. It stays mounted after the
  // window closes, so a saved pick and its undo survive, as on the race panel.
  const [predictGoalId, setPredictGoalId] = useState<string | null>(null)
  const [predictTarget, setPredictTarget] = useState<{ index: number; name: string } | null>(
    null
  )
  const predictRace = predictRaces.find((race) => race.goalId === predictGoalId)
  const openPredict = (goalId: string, index: number, name: string) => {
    setPredictGoalId(goalId)
    setPredictTarget({ index, name })
  }

  const placedRefs = useMemo(
    () => new Set(layout.items.filter((item) => item.kind === 'asset').map((item) => item.ref)),
    [layout.items]
  )

  // An asset stays on the plot when its prediction goes away, as an empty
  // locked lot, so predicting it again brings it straight back. Nothing is
  // held back until the read has actually finished: a slow or failed read must
  // not look like a visitor who backs nothing.
  const picksKnown = (status === 'ready' && !betsPending) || status === 'signed-out'
  const heldBackIds = useMemo(() => {
    const ids = new Set<string>()
    if (!picksKnown) return ids
    for (const item of layout.items) {
      if (item.kind === 'asset' && !unlocked.has(item.ref)) ids.add(item.id)
    }
    return ids
  }, [picksKnown, layout.items, unlocked])

  const selectedItem = selectedId
    ? layout.items.find((item) => item.id === selectedId)
    : undefined
  // Undo can remove the selected item out from under the selection.
  useEffect(() => {
    if (selectedId && !selectedItem) setSelectedId(null)
  }, [selectedId, selectedItem])

  const notify = (message: string) => toast(message, { id: TOAST_ID, style: toastStyle })

  const resetTool = () => {
    setTool('select')
    setPending(null)
    setRoadStart(null)
  }

  const startPlacing = (kind: ItemKind, ref: string) => {
    const span = spanFor(kind, ref)
    if (span === undefined) return
    if (layout.items.length >= MAX_ITEMS) {
      notify('The plot is full. Remove something to make room.')
      return
    }
    setTool('place')
    setPending({ kind, ref, span, rot: 0 })
    setRoadStart(null)
    setSelectedId(null)
  }

  const flyTo = (item: PlacedItem) => {
    const centre = footprintCenterM(item.x, item.z, item.span)
    setFocus((prev) => ({
      xM: centre.x,
      zM: centre.z,
      distM: Math.min(170, Math.max(40, item.span * CELL_M * 2 + 30)),
      nonce: (prev?.nonce ?? 0) + 1,
    }))
  }

  const handlePlaceAsset = (projectId: string) => {
    if (!unlocked.has(projectId) || placedRefs.has(projectId)) return
    startPlacing('asset', projectId)
    if (window.innerWidth < 640) setInventoryOpen(false)
  }

  const handleFindAsset = (projectId: string) => {
    const item = layout.items.find((it) => it.kind === 'asset' && it.ref === projectId)
    if (!item) return
    resetTool()
    setSelectedId(item.id)
    flyTo(item)
  }

  const handleCellClick = (cell: Cell) => {
    if (tool === 'place' && pending) {
      const anchor = footprintAnchor(cell, pending.span)
      if (!canPlace(layout, { ...anchor, span: pending.span }, pending.moveId)) {
        notify('That ground is taken.')
        return
      }
      if (pending.moveId) {
        const id = pending.moveId
        edit((current) => setItemRot(moveItem(current, id, anchor), id, pending.rot))
        resetTool()
        setSelectedId(id)
        return
      }
      const id = newItemId()
      edit((current) =>
        placeItem(current, {
          id,
          kind: pending.kind,
          ref: pending.ref,
          x: anchor.x,
          z: anchor.z,
          span: pending.span,
          rot: pending.rot,
        })
      )
      if (pending.kind === 'asset') {
        // One of each: there is nothing left to place, so hand back the cursor.
        resetTool()
        setSelectedId(id)
      } else if (layout.items.length + 1 >= MAX_ITEMS) {
        resetTool()
        notify('The plot is full. Remove something to make room.')
      }
      return
    }

    if (tool === 'road') {
      if (!roadStart) {
        setRoadStart(cell)
        return
      }
      const start = roadStart
      edit((current) => addRoads(current, roadPath(start, cell)))
      setRoadStart(null)
      return
    }

    if (tool === 'erase') {
      const item = itemAt(layout, cell)
      if (item) edit((current) => removeItem(current, item.id))
      else if (hasRoad(layout, cell)) edit((current) => removeRoad(current, cell))
      return
    }

    // Selecting by the ground as well as by the model: small hardware is a few
    // pixels wide from the default view, and its lot is not.
    setSelectedId(itemAt(layout, cell)?.id ?? null)
  }

  const handleItemClick = (id: string) => {
    if (tool === 'erase') {
      edit((current) => removeItem(current, id))
      return
    }
    if (tool === 'select') setSelectedId(id)
  }
  // The scene memoises each placed item, so the handler it is given must keep
  // one identity while still seeing the current tool.
  const itemClickRef = useRef(handleItemClick)
  itemClickRef.current = handleItemClick
  const stableItemClick = useCallback((id: string) => itemClickRef.current(id), [])

  const rotateActive = () => {
    if (pending) {
      setPending({ ...pending, rot: nextRot(pending.rot) })
      return
    }
    if (selectedItem && !heldBackIds.has(selectedItem.id)) {
      const { id, rot } = selectedItem
      edit((current) => setItemRot(current, id, nextRot(rot)))
    }
  }

  const moveSelected = () => {
    if (!selectedItem || heldBackIds.has(selectedItem.id)) return
    setTool('place')
    setPending({
      kind: selectedItem.kind,
      ref: selectedItem.ref,
      span: selectedItem.span,
      rot: selectedItem.rot,
      moveId: selectedItem.id,
    })
    setRoadStart(null)
  }

  const removeSelected = () => {
    if (!selectedItem) return
    const { id } = selectedItem
    edit((current) => removeItem(current, id))
    setSelectedId(null)
  }

  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {})
  keyRef.current = (e: KeyboardEvent) => {
    // The predict window owns the keyboard while it is open.
    if (isTyping(e.target) || predictTarget) return
    const mod = e.metaKey || e.ctrlKey
    const key = e.key.toLowerCase()
    if (mod && key === 'z') {
      e.preventDefault()
      if (e.shiftKey) redo()
      else undo()
      return
    }
    if (mod || e.altKey) return
    if (key === 'escape') {
      if (tool !== 'select' || pending || roadStart) resetTool()
      else setSelectedId(null)
    } else if (key === 'r') {
      rotateActive()
    } else if (key === 'm') {
      moveSelected()
    } else if (key === 'delete' || key === 'backspace') {
      if (selectedItem && tool === 'select') {
        e.preventDefault()
        removeSelected()
      }
    }
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyRef.current(e)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const selectedSummary = useMemo<SelectedSummary | null>(() => {
    if (!selectedItem) return null
    if (selectedItem.kind === 'decor') {
      return { name: decorById(selectedItem.ref)?.label ?? 'Scenery', locked: false }
    }
    const info = catalog.get(selectedItem.ref)
    const ref = selectedItem.ref
    // The first open race this asset runs in, at its slot there.
    let again: { goalId: string; index: number } | undefined
    for (const race of races) {
      const entry = race.field.find((f) => f.asset.project.id === ref)
      if (entry && !race.closedReason) {
        again = { goalId: race.goal.id, index: entry.index }
        break
      }
    }
    return {
      name: info?.project.name ?? ref,
      detail: info?.orgName,
      locked: heldBackIds.has(selectedItem.id),
      onPredictAgain: again
        ? () => openPredict(again!.goalId, again!.index, info?.project.name ?? ref)
        : undefined,
    }
    // `openPredict` only sets state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItem, catalog, races, heldBackIds])

  // A phone has no keyboard, no right button and no wheel, so it is not told
  // about any of them.
  const tap = touch ? 'Tap' : 'Click'
  const keys = (text: string) => (touch ? '' : ` · ${text}`)
  const hint =
    tool === 'place'
      ? pending?.moveId
        ? `${tap} the plot to set it down${keys('R turns it · Esc cancels')}`
        : pending?.kind === 'decor'
        ? `${tap} the plot to place it, as many times as you like${keys('R turns it · Esc stops')}`
        : `${tap} the plot to place it${keys('R turns it · Esc cancels')}`
      : tool === 'road'
      ? roadStart
        ? `${tap} where the road ends${keys('Esc cancels')}`
        : `${tap} where the road starts`
      : tool === 'erase'
      ? `${tap} a road tile or an item to remove it`
      : selectedItem
      ? 'Rotate, move or remove it'
      : touch
      ? 'Drag to move around · two fingers to turn and zoom'
      : 'Drag to move around · right-drag to turn · scroll to zoom'

  const openShare = () => {
    // The picture is of the base, not of a tool in mid-use.
    resetTool()
    setSelectedId(null)
    setSharing(true)
  }

  const saveNote: { text: string; warn?: boolean } = !loaded
    ? { text: 'Loading your base…' }
    : sync.status === 'checking'
    ? { text: 'Checking your account for a saved base…' }
    : sync.status === 'saving'
    ? { text: 'Saving…' }
    : sync.status === 'saved'
    ? { text: sync.shareId ? 'Saved to your account.' : 'Saves to your account as you build.' }
    : sync.status === 'conflict'
    ? { text: 'Not saving to your account yet.', warn: true }
    : sync.status === 'error'
    ? { text: 'Not saved to your account. It is kept in this browser.', warn: true }
    : saveFailed
    ? { text: 'Not saved: this browser is blocking storage.', warn: true }
    : sync.status === 'local' && identityReady
    ? { text: 'Saved in this browser only. Predict a race or sign in to keep it with your account.' }
    : { text: 'Saved in this browser.' }

  const assetCount = placedRefs.size
  const sceneryCount = layout.items.length - assetCount
  const isEmpty = layout.items.length === 0 && layout.roads.length === 0

  return (
    <div className="relative h-[calc(100vh-4rem)] w-full overflow-hidden bg-black">
      <div
        className="absolute inset-0"
        role="region"
        aria-label="My Moonbase, a 3D plot you build from the hardware you predict"
      >
        {skipScene ? (
          <SceneFallback />
        ) : (
          <BuilderScene
            layout={layout}
            tool={tool}
            pending={pending}
            roadStart={roadStart}
            selectedId={selectedId}
            heldBackIds={heldBackIds}
            assetInfo={assetInfo}
            focus={focus}
            onCellClick={handleCellClick}
            onItemClick={stableItemClick}
            onBackgroundClick={() => {
              if (tool === 'select') setSelectedId(null)
            }}
            captureRef={captureRef}
          />
        )}
      </div>

      <div className="pointer-events-none absolute inset-0 flex flex-col">
        <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-5">
          <div className="flex min-h-0 w-full flex-col gap-3 sm:w-80">
            <div className="pointer-events-auto shrink-0 rounded-2xl border border-white/10 bg-black/50 px-4 py-3 backdrop-blur-md">
              <div className="flex items-center justify-between gap-2">
                <Link
                  href="/moonbase"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-300 hover:text-cyan-200"
                >
                  <ChevronLeftIcon className="h-3 w-3" />
                  Moon Base Zero
                </Link>
                <button
                  type="button"
                  onClick={openShare}
                  className="inline-flex items-center gap-1 rounded-md bg-cyan-300 px-2 py-1 text-[11px] font-bold text-black transition hover:bg-cyan-200"
                >
                  <ShareIcon className="h-3 w-3" />
                  Share
                </button>
              </div>
              <input
                value={layout.name}
                onChange={(e) => edit((current) => renameBase(current, e.target.value), 'name')}
                maxLength={MAX_NAME_LENGTH}
                placeholder={DEFAULT_BASE_NAME}
                aria-label="Name your base"
                spellCheck={false}
                className="mt-0.5 w-full truncate rounded-md border border-transparent bg-transparent px-1 py-0.5 text-lg font-semibold text-white outline-none transition placeholder:text-white/30 hover:border-white/15 focus:border-cyan-300/50 -ml-1"
              />
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-white/50">
                  {assetCount} {assetCount === 1 ? 'asset' : 'assets'} · {sceneryCount} scenery ·{' '}
                  {layout.roads.length} road
                </p>
                <button
                  type="button"
                  onClick={() => setInventoryOpen((open) => !open)}
                  aria-expanded={inventoryOpen}
                  className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-white/60 hover:bg-white/10 hover:text-white"
                >
                  Hardware
                  {inventoryOpen ? (
                    <ChevronUpIcon className="h-3 w-3" />
                  ) : (
                    <ChevronDownIcon className="h-3 w-3" />
                  )}
                </button>
              </div>
              <p
                role="status"
                className={`mt-1 text-[11px] ${saveNote.warn ? 'text-amber-200/90' : 'text-white/35'}`}
              >
                {saveNote.text}
                {sync.status === 'error' && (
                  <>
                    {' '}
                    <button type="button" onClick={sync.retry} className="font-semibold underline">
                      Try again
                    </button>
                  </>
                )}
              </p>
              {sync.status === 'conflict' && (
                <div className="mt-2 rounded-lg border border-amber-200/30 bg-amber-200/10 p-2">
                  <p className="text-[11px] leading-relaxed text-amber-100">
                    Your account already holds a different base, saved from somewhere else. Which
                    one do you want to keep? The other is replaced.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={sync.keepMine}
                      className="flex-1 rounded-md bg-white/10 px-2 py-1.5 text-[11px] font-semibold text-white transition hover:bg-white/20"
                    >
                      Keep this one
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        resetTool()
                        setSelectedId(null)
                        sync.loadSaved()
                      }}
                      className="flex-1 rounded-md bg-white/10 px-2 py-1.5 text-[11px] font-semibold text-white transition hover:bg-white/20"
                    >
                      Load the saved one
                    </button>
                  </div>
                </div>
              )}
            </div>

            {inventoryOpen && (
              <div className="flex max-h-[38vh] min-h-0 flex-col sm:max-h-none">
                <InventoryPanel
                  races={races}
                  status={status}
                  placedRefs={placedRefs}
                  pendingRef={pending?.kind === 'asset' && !pending.moveId ? pending.ref : null}
                  onPlace={handlePlaceAsset}
                  onFind={handleFindAsset}
                  onSignIn={login}
                  onRetry={refresh}
                  onPredict={openPredict}
                />
              </div>
            )}
          </div>
        </div>

        <div className="px-3 pb-4 sm:pb-5">
          <BuildBar
            tool={tool}
            pendingDecorId={pending?.kind === 'decor' && !pending.moveId ? pending.ref : null}
            hint={hint}
            selected={tool === 'select' ? selectedSummary : null}
            canUndo={canUndo}
            canRedo={canRedo}
            isEmpty={isEmpty}
            onTool={(next) => {
              setTool(next)
              setPending(null)
              setRoadStart(null)
              if (next !== 'select') setSelectedId(null)
            }}
            onPickDecor={(id) => startPlacing('decor', id)}
            onUndo={undo}
            onRedo={redo}
            onClear={() => {
              resetTool()
              setSelectedId(null)
              // The name is the visitor's, not part of what is on the ground.
              edit((current) => ({ ...emptyLayout(), name: current.name }))
            }}
            onRotate={rotateActive}
            onMove={moveSelected}
            onRemove={removeSelected}
          />
        </div>
      </div>

      {sharing && (
        <ShareBaseModal
          name={layout.name}
          predicted={races.filter((race) => race.assets.length > 0).length}
          total={races.length}
          status={sync.status}
          touch={touch}
          capture={capture}
          saveNow={sync.saveNow}
          onSignIn={login}
          onClose={() => setSharing(false)}
        />
      )}

      {predictRace && (
        <ForecastPredictModal
          chain={chain}
          chainSlug={chainSlug}
          deprizeId={predictRace.voteId}
          numOutcomes={predictRace.outcomeIds.length}
          labels={predictRace.labels}
          reported={market?.goalId === predictRace.goalId && market.resolved}
          marketLoading={market?.goalId === predictRace.goalId && market.payoutPending}
          outcomeIndex={predictTarget?.index ?? null}
          teamName={predictTarget?.name ?? ''}
          onClose={() => setPredictTarget(null)}
        />
      )}
    </div>
  )
}
