/**
 * Data blocks an update can embed as fenced code: ```chart, ```stats,
 * ```heatmap, ```ledger, ```screens, ```cta, ```timeline and ```graphic, each
 * holding one JSON object.
 * The renderer falls back to a plain code block when the JSON does not parse or
 * fails these checks.
 */

export const UPDATE_BLOCK_LANGUAGES = [
  'chart',
  'stats',
  'heatmap',
  'ledger',
  'screens',
  'cta',
  'timeline',
  'graphic',
] as const
export type UpdateBlockLanguage = (typeof UPDATE_BLOCK_LANGUAGES)[number]

type FigureText = {
  figure?: string
  title?: string
  subtitle?: string
  source?: string
}

export type Series = { name: string; color?: string }

export type DotsChart = FigureText & {
  type: 'dots'
  unit?: string
  max?: number
  series: Series[]
  marker?: { name: string }
  rows: { label: string; values: number[]; marker?: number }[]
}

export type ScatterChart = FigureText & {
  type: 'scatter'
  unit?: string
  x: { label: string; min: number; max: number }
  y: { label: string; min: number; max: number }
  points: {
    label: string
    x: number
    y: number
    color?: string
    anchor?: 'left' | 'right' | 'top' | 'bottom'
  }[]
  trend?: boolean
}

export type BarsChart = FigureText & {
  type: 'bars'
  /** Appended to each value label, e.g. "%". */
  unit?: string
  rows: { label: string; color?: string }[]
  panels: { name: string; values: number[] }[]
}

export type LineChart = FigureText & {
  type: 'line'
  unit?: string
  y: { min: number; max: number }
  /** `labels` replaces the index ticks; empty strings are skipped. */
  x: { label?: string; count: number; labels?: string[] }
  bands?: { label: string; from: number; to: number; color?: string }[]
  series: { name: string; color?: string; dashed?: boolean; values: number[] }[]
}

export type StackChart = FigureText & {
  type: 'stack'
  unit?: string
  segments: Series[]
  rows: { label: string; values: number[] }[]
}

export type ChartSpec = DotsChart | ScatterChart | BarsChart | LineChart | StackChart

export type StatsSpec = { items: { value: string; label: string }[] }

export type HeatmapSpec = FigureText & {
  columns: string[]
  /** Optional shorter column labels for narrow screens. */
  shortColumns?: string[]
  unit?: string
  rows: {
    label: string
    sub?: string
    color?: string
    cells: { value: number; note?: string; mark?: boolean }[]
  }[]
}

export type LedgerSpec = FigureText & {
  max?: number
  unit?: string
  rows: {
    label: string
    color?: string
    trades: { outcome: string; color?: string; size: number }[]
  }[]
}

/** Product screenshots in a browser frame, each linking to the live page. */
export type ScreensSpec = FigureText & {
  /** Side by side from md up. Stacked by default. */
  columns?: 1 | 2
  items: {
    src: string
    alt: string
    /** Address shown in the frame's bar, e.g. moondao.com/deprize/arb/1. */
    url?: string
    href?: string
    caption?: string
  }[]
}

export type CtaAction = { label: string; href: string; primary?: boolean }

export type CtaSpec = {
  eyebrow?: string
  title: string
  body?: string
  points?: string[]
  actions: CtaAction[]
  image?: { src: string; alt: string }
  note?: string
}

/** Dated milestones on a vertical rail. `status` sets the marker: done, now or next. */
export type TimelineSpec = FigureText & {
  items: {
    date: string
    title: string
    body?: string
    status?: 'done' | 'now' | 'next'
  }[]
}

/**
 * A drawn illustration or diagram in the figure frame. `narrow` is an optional
 * phone-width version of the same image.
 */
export type GraphicSpec = FigureText & {
  src: string
  alt: string
  narrow?: string
}

export type UpdateBlock =
  | { kind: 'chart'; spec: ChartSpec }
  | { kind: 'stats'; spec: StatsSpec }
  | { kind: 'heatmap'; spec: HeatmapSpec }
  | { kind: 'ledger'; spec: LedgerSpec }
  | { kind: 'screens'; spec: ScreensSpec }
  | { kind: 'cta'; spec: CtaSpec }
  | { kind: 'timeline'; spec: TimelineSpec }
  | { kind: 'graphic'; spec: GraphicSpec }

const isObj = (v: unknown): v is Record<string, any> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
const nums = (v: unknown, length?: number) =>
  Array.isArray(v) && v.every(isNum) && (length === undefined || v.length === length)
const labelled = (v: unknown) =>
  Array.isArray(v) && v.length > 0 && v.every((r) => isObj(r) && isStr(r.label))
const range = (v: unknown) => isObj(v) && isNum(v.min) && isNum(v.max) && v.max > v.min

function validChart(s: Record<string, any>): boolean {
  switch (s.type) {
    case 'dots':
      return (
        Array.isArray(s.series) &&
        s.series.length > 0 &&
        labelled(s.rows) &&
        s.rows.every((r: any) => nums(r.values, s.series.length))
      )
    case 'scatter':
      return (
        range(s.x) &&
        range(s.y) &&
        labelled(s.points) &&
        s.points.every((p: any) => isNum(p.x) && isNum(p.y))
      )
    case 'bars':
      return (
        labelled(s.rows) &&
        Array.isArray(s.panels) &&
        s.panels.length > 0 &&
        s.panels.every((p: any) => isStr(p.name) && nums(p.values, s.rows.length))
      )
    case 'line':
      return (
        range(s.y) &&
        isObj(s.x) &&
        isNum(s.x.count) &&
        s.x.count > 1 &&
        (s.x.labels === undefined ||
          (Array.isArray(s.x.labels) &&
            s.x.labels.length === s.x.count &&
            s.x.labels.every(isStr))) &&
        Array.isArray(s.series) &&
        s.series.length > 0 &&
        s.series.every((r: any) => isStr(r.name) && nums(r.values, s.x.count))
      )
    case 'stack':
      return (
        Array.isArray(s.segments) &&
        s.segments.length > 0 &&
        labelled(s.rows) &&
        s.rows.every((r: any) => nums(r.values, s.segments.length))
      )
    default:
      return false
  }
}

export function isUpdateBlockLanguage(lang: string | undefined): lang is UpdateBlockLanguage {
  return !!lang && (UPDATE_BLOCK_LANGUAGES as readonly string[]).includes(lang)
}

export function parseUpdateBlock(lang: string, source: string): UpdateBlock | null {
  if (!isUpdateBlockLanguage(lang)) return null
  let spec: unknown
  try {
    spec = JSON.parse(source)
  } catch {
    return null
  }
  if (!isObj(spec)) return null

  switch (lang) {
    case 'chart':
      return validChart(spec) ? { kind: 'chart', spec: spec as ChartSpec } : null
    case 'stats':
      return Array.isArray(spec.items) &&
        spec.items.length > 0 &&
        spec.items.every((i: any) => isObj(i) && isStr(i.value) && isStr(i.label))
        ? { kind: 'stats', spec: spec as StatsSpec }
        : null
    case 'heatmap':
      return Array.isArray(spec.columns) &&
        labelled(spec.rows) &&
        spec.rows.every(
          (r: any) =>
            Array.isArray(r.cells) &&
            r.cells.length === spec.columns.length &&
            r.cells.every((c: any) => isObj(c) && isNum(c.value))
        )
        ? { kind: 'heatmap', spec: spec as HeatmapSpec }
        : null
    case 'ledger':
      return labelled(spec.rows) &&
        spec.rows.every(
          (r: any) =>
            Array.isArray(r.trades) && r.trades.every((t: any) => isObj(t) && isNum(t.size))
        )
        ? { kind: 'ledger', spec: spec as LedgerSpec }
        : null
    case 'screens':
      return Array.isArray(spec.items) &&
        spec.items.length > 0 &&
        spec.items.every((i: any) => isObj(i) && isStr(i.src) && isStr(i.alt))
        ? { kind: 'screens', spec: spec as ScreensSpec }
        : null
    case 'cta':
      return isStr(spec.title) &&
        Array.isArray(spec.actions) &&
        spec.actions.length > 0 &&
        spec.actions.every((a: any) => isObj(a) && isStr(a.label) && isStr(a.href)) &&
        (spec.image === undefined ||
          (isObj(spec.image) && isStr(spec.image.src) && isStr(spec.image.alt))) &&
        (spec.points === undefined || (Array.isArray(spec.points) && spec.points.every(isStr)))
        ? { kind: 'cta', spec: spec as CtaSpec }
        : null
    case 'timeline':
      return Array.isArray(spec.items) &&
        spec.items.length > 0 &&
        spec.items.every(
          (i: any) =>
            isObj(i) &&
            isStr(i.date) &&
            isStr(i.title) &&
            (i.body === undefined || isStr(i.body)) &&
            (i.status === undefined || ['done', 'now', 'next'].includes(i.status))
        )
        ? { kind: 'timeline', spec: spec as TimelineSpec }
        : null
    case 'graphic':
      return isStr(spec.src) &&
        isStr(spec.alt) &&
        (spec.narrow === undefined || isStr(spec.narrow))
        ? { kind: 'graphic', spec: spec as GraphicSpec }
        : null
  }
}

/** Fenced data blocks and collapsed `<details>` are not read straight through. */
export function stripNonProse(body: string): string {
  return body
    .replace(
      new RegExp('```(' + UPDATE_BLOCK_LANGUAGES.join('|') + ')\\n[\\s\\S]*?\\n```', 'g'),
      ''
    )
    .replace(/<details>[\s\S]*?<\/details>/g, '')
}
