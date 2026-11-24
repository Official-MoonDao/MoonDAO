/**
 * The link-preview picture of a base: its plot seen from straight above.
 * Pure SVG text, so it is drawn without the 3D scene and can be tested.
 */
import { renderOgSvg } from '@/lib/og/svg'
import { GRID_CELLS, parseCellKey, type MoonbaseLayout } from './grid'
import { BASE_SHARE_URL_LABEL, baseCounts, publicBaseName } from './share'

// The media slot of the shared card (see renderOgSvg), made square.
const PLAN_X = 770
const PLAN_Y = 125
const PLAN_SIZE = 380
const CELL_PX = PLAN_SIZE / GRID_CELLS

const COLOR_RE = /^#[0-9a-f]{3,8}$/i
const DECOR_COLOR = '#94a3b8'
const ASSET_COLOR = '#67e8f9'

function px(cells: number): string {
  return (cells * CELL_PX).toFixed(1)
}

/** The plot from above: roads, scenery, and each asset in its builder's colour. */
export function basePlanSvg(
  layout: MoonbaseLayout,
  colorFor: (projectId: string) => string | undefined
): string {
  const roads = layout.roads
    .map(parseCellKey)
    .filter((cell): cell is NonNullable<typeof cell> => cell !== null)
    .map(
      (cell) =>
        `<rect x="${px(cell.x)}" y="${px(cell.z)}" width="${px(1)}" height="${px(
          1
        )}" fill="#64748b"/>`
    )
    .join('')

  const lots = layout.items
    .map((item) => {
      const inset = item.kind === 'asset' ? 1 : 1.5
      const side = item.span * CELL_PX - inset * 2
      if (side <= 0) return ''
      const claimed = item.kind === 'asset' ? colorFor(item.ref) : undefined
      const color =
        item.kind === 'decor'
          ? DECOR_COLOR
          : claimed && COLOR_RE.test(claimed)
          ? claimed
          : ASSET_COLOR
      const x = (item.x * CELL_PX + inset).toFixed(1)
      const y = (item.z * CELL_PX + inset).toFixed(1)
      return item.kind === 'asset'
        ? `<rect x="${x}" y="${y}" width="${side.toFixed(1)}" height="${side.toFixed(
            1
          )}" rx="3" fill="${color}" fill-opacity="0.9" stroke="#ffffff" stroke-opacity="0.55" stroke-width="1"/>`
        : `<rect x="${x}" y="${y}" width="${side.toFixed(1)}" height="${side.toFixed(
            1
          )}" rx="2" fill="${color}" fill-opacity="0.55"/>`
    })
    .join('')

  return `<g transform="translate(${PLAN_X} ${PLAN_Y})">
    <rect width="${PLAN_SIZE}" height="${PLAN_SIZE}" rx="18" fill="#1e293b" stroke="rgba(255,255,255,0.16)"/>
    <svg width="${PLAN_SIZE}" height="${PLAN_SIZE}" viewBox="0 0 ${PLAN_SIZE} ${PLAN_SIZE}">
      <clipPath id="plot"><rect width="${PLAN_SIZE}" height="${PLAN_SIZE}" rx="18"/></clipPath>
      <g clip-path="url(#plot)">${roads}${lots}</g>
    </svg>
  </g>`
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

/** The whole 1200×630 card for a saved base. */
export function baseOgSvg(
  layout: MoonbaseLayout,
  colorFor: (projectId: string) => string | undefined,
  extraBlocklist = ''
): string {
  const counts = baseCounts(layout)
  const card = renderOgSvg({
    eyebrow: 'MoonDAO  ·  My Moonbase',
    title: publicBaseName(layout.name, extraBlocklist),
    subtitle: 'A moonbase built from predictions',
    chips: [
      plural(counts.assets, 'asset', 'assets'),
      ...(counts.scenery ? [`${counts.scenery} scenery`] : []),
      ...(counts.roads ? [plural(counts.roads, 'road tile', 'road tiles')] : []),
    ],
    footer: BASE_SHARE_URL_LABEL,
  })
  return card.replace(/<\/svg>\s*$/, `${basePlanSvg(layout, colorFor)}\n</svg>`)
}

/** The card for a link that names no base, or one that is gone. */
export function genericBaseOgSvg(): string {
  return renderOgSvg({
    eyebrow: 'MoonDAO  ·  My Moonbase',
    title: 'Build your own moonbase',
    subtitle: 'From the hardware you predict will win',
    chips: ['Free to predict', 'Place, pave, share'],
    footer: BASE_SHARE_URL_LABEL,
  })
}
