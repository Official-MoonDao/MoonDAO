import {
  ArrowPathIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  ArrowsPointingOutIcon,
  CursorArrowRaysIcon,
  CubeIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import Link from 'next/link'
import { useState, type ReactNode } from 'react'
import { DECOR, DECOR_GROUPS } from '@/lib/my-moonbase/decor'
import type { BuilderTool } from './assets'

function RoadIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 3 4 21M16 3l4 18M12 4v3m0 4v3m0 4v2" />
    </svg>
  )
}

function ToolButton({
  label,
  title,
  active = false,
  disabled = false,
  danger = false,
  onClick,
  children,
}: {
  label: string
  title?: string
  active?: boolean
  disabled?: boolean
  danger?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
      aria-pressed={active}
      className={`flex min-w-[3.25rem] flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[10px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-30 ${
        active
          ? danger
            ? 'bg-red-400 text-black'
            : 'bg-cyan-300 text-black'
          : 'text-white/70 hover:bg-white/10 hover:text-white'
      }`}
    >
      {children}
      {label}
    </button>
  )
}

export type SelectedSummary = {
  name: string
  detail?: string
  /** The visitor no longer backs this asset, so only its empty plot is drawn. */
  locked: boolean
  /** Where to predict it again. */
  raceHref?: string
}

export default function BuildBar({
  tool,
  pendingDecorId,
  hint,
  selected,
  canUndo,
  canRedo,
  isEmpty,
  onTool,
  onPickDecor,
  onUndo,
  onRedo,
  onClear,
  onRotate,
  onMove,
  onRemove,
}: {
  tool: BuilderTool
  /** Scenery riding the pointer, if any. */
  pendingDecorId: string | null
  hint: string
  selected: SelectedSummary | null
  canUndo: boolean
  canRedo: boolean
  isEmpty: boolean
  onTool: (tool: 'select' | 'road' | 'erase') => void
  onPickDecor: (id: string) => void
  onUndo: () => void
  onRedo: () => void
  onClear: () => void
  onRotate: () => void
  onMove: () => void
  onRemove: () => void
}) {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  const pickTool = (next: 'select' | 'road' | 'erase') => {
    setPaletteOpen(false)
    setConfirmClear(false)
    onTool(next)
  }

  return (
    <div className="pointer-events-none flex w-full flex-col items-center gap-2">
      {selected && (
        <div className="pointer-events-auto flex max-w-full flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-cyan-300/25 bg-black/70 px-3 py-2 backdrop-blur-md">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{selected.name}</p>
            {selected.locked ? (
              <p className="text-[11px] text-amber-200/90">
                You no longer predict this one.{' '}
                {selected.raceHref && (
                  <Link href={selected.raceHref} className="font-semibold underline">
                    Predict it again
                  </Link>
                )}
              </p>
            ) : (
              selected.detail && (
                <p className="truncate text-[11px] text-white/50">{selected.detail}</p>
              )
            )}
          </div>
          <div className="flex items-center gap-1">
            {!selected.locked && (
              <>
                <button
                  type="button"
                  onClick={onRotate}
                  title="Rotate (R)"
                  className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] font-medium text-white/80 transition hover:border-white/30 hover:text-white"
                >
                  <ArrowPathIcon className="h-3.5 w-3.5" />
                  Rotate
                </button>
                <button
                  type="button"
                  onClick={onMove}
                  title="Move (M)"
                  className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] font-medium text-white/80 transition hover:border-white/30 hover:text-white"
                >
                  <ArrowsPointingOutIcon className="h-3.5 w-3.5" />
                  Move
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onRemove}
              title="Remove (Delete)"
              className="flex items-center gap-1 rounded-md border border-red-400/30 px-2 py-1 text-[11px] font-medium text-red-300 transition hover:border-red-400/60 hover:text-red-200"
            >
              <TrashIcon className="h-3.5 w-3.5" />
              Remove
            </button>
          </div>
        </div>
      )}

      {paletteOpen && (
        <div className="pointer-events-auto w-[min(92vw,30rem)] rounded-xl border border-white/10 bg-black/80 p-3 backdrop-blur-md">
          {DECOR_GROUPS.map((group) => (
            <div key={group} className="mb-2 last:mb-0">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-white/40">
                {group}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {DECOR.filter((decor) => decor.group === group).map((decor) => (
                  <button
                    key={decor.id}
                    type="button"
                    onClick={() => {
                      // Out of the way: the palette sits over the ground it is about to go on.
                      setPaletteOpen(false)
                      onPickDecor(decor.id)
                    }}
                    aria-pressed={pendingDecorId === decor.id}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                      pendingDecorId === decor.id
                        ? 'bg-cyan-300 text-black'
                        : 'bg-white/10 text-white/85 hover:bg-white/20'
                    }`}
                  >
                    {decor.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="rounded-full bg-black/55 px-3 py-1 text-center text-[11px] text-white/65 backdrop-blur-md">
        {hint}
      </p>

      <div className="pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-black/70 p-1.5 backdrop-blur-md">
        <ToolButton
          label="Select"
          title="Select and move the camera (Esc)"
          active={tool === 'select'}
          onClick={() => pickTool('select')}
        >
          <CursorArrowRaysIcon className="h-5 w-5" />
        </ToolButton>
        <ToolButton
          label="Road"
          title="Build road: click a start, then an end"
          active={tool === 'road'}
          onClick={() => pickTool('road')}
        >
          <RoadIcon className="h-5 w-5" />
        </ToolButton>
        <ToolButton
          label="Scenery"
          title="Lights, solar, cargo and rocks"
          active={paletteOpen || pendingDecorId !== null}
          onClick={() => {
            setConfirmClear(false)
            setPaletteOpen((open) => !open)
          }}
        >
          <CubeIcon className="h-5 w-5" />
        </ToolButton>
        <ToolButton
          label="Erase"
          title="Erase: click a road tile or an item"
          active={tool === 'erase'}
          danger
          onClick={() => pickTool('erase')}
        >
          <TrashIcon className="h-5 w-5" />
        </ToolButton>

        <span className="mx-1 h-8 w-px shrink-0 bg-white/10" />

        <ToolButton label="Undo" disabled={!canUndo} onClick={onUndo}>
          <ArrowUturnLeftIcon className="h-5 w-5" />
        </ToolButton>
        <ToolButton label="Redo" disabled={!canRedo} onClick={onRedo}>
          <ArrowUturnRightIcon className="h-5 w-5" />
        </ToolButton>

        <span className="mx-1 h-8 w-px shrink-0 bg-white/10" />

        {confirmClear ? (
          <div className="flex items-center gap-1 px-1">
            <button
              type="button"
              onClick={() => {
                setConfirmClear(false)
                onClear()
              }}
              className="rounded-md bg-red-400 px-2.5 py-1.5 text-[11px] font-bold text-black"
            >
              Clear plot
            </button>
            <button
              type="button"
              onClick={() => setConfirmClear(false)}
              className="rounded-md px-2 py-1.5 text-[11px] font-medium text-white/70 hover:text-white"
            >
              Keep
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={isEmpty}
            onClick={() => setConfirmClear(true)}
            className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-white/55 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  )
}
