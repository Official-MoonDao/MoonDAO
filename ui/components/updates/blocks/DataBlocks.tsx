import type { HeatmapSpec, LedgerSpec, StatsSpec } from '@/lib/updates/blocks'
import Figure, { type LegendItem } from './Figure'

export function Stats({ spec }: { spec: StatsSpec }) {
  return (
    <div className="my-10 grid grid-cols-2 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] md:grid-cols-4">
      {spec.items.map((item, i) => (
        <div
          key={item.label}
          className={`relative p-4 sm:p-5 md:p-6 ${i % 2 ? 'border-l' : ''} ${
            i >= 2 ? 'border-t md:border-t-0' : ''
          } ${i > 0 ? 'md:border-l' : ''} border-white/10`}
        >
          <span
            aria-hidden
            className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-blue-400/0 via-blue-400/60 to-purple-400/0 md:inset-x-6"
          />
          <p className="whitespace-nowrap font-heading text-[21px] font-semibold tracking-tight text-white sm:text-2xl md:text-[28px]">
            {item.value}
          </p>
          <p className="mt-2 text-[13px] leading-snug text-slate-400">{item.label}</p>
        </div>
      ))}
    </div>
  )
}

function heat(value: number, span: number): string {
  const a = Math.min(1, Math.abs(value) / span) * 0.55 + 0.04
  return value >= 0 ? `rgba(16,185,129,${a})` : `rgba(244,63,94,${a})`
}

export function Heatmap({ spec }: { spec: HeatmapSpec }) {
  const span = Math.max(...spec.rows.flatMap((r) => r.cells.map((c) => Math.abs(c.value)))) || 1
  const unit = spec.unit ? ` ${spec.unit}` : ''
  return (
    <Figure figure={spec.figure} title={spec.title} subtitle={spec.subtitle} source={spec.source}>
      <div>
        <table className="w-full table-fixed border-separate border-spacing-[3px] text-center sm:border-spacing-1">
          <thead>
            <tr>
              <th className="hidden w-[110px] sm:table-cell" />
              {spec.columns.map((col, i) => (
                <th
                  key={col}
                  className="whitespace-nowrap px-0.5 pb-2 align-bottom text-[10px] font-medium leading-tight text-slate-400 sm:whitespace-normal sm:text-[11px]"
                >
                  <span className="sm:hidden">{spec.shortColumns?.[i] || col}</span>
                  <span className="hidden sm:inline">{col}</span>
                </th>
              ))}
            </tr>
          </thead>
          {spec.rows.map((row) => {
            const name = (
              <span className="flex items-center gap-2 text-[13px] font-semibold text-white sm:text-[14px]">
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: row.color }}
                />
                {row.label}
                {row.sub && (
                  <span className="font-normal text-slate-500 sm:hidden">· {row.sub}</span>
                )}
              </span>
            )
            return (
              <tbody key={row.label}>
                <tr className="sm:hidden">
                  <th
                    scope="rowgroup"
                    colSpan={spec.columns.length}
                    className="pb-0.5 pt-2 text-left"
                  >
                    {name}
                  </th>
                </tr>
                <tr>
                  <th scope="row" className="hidden pr-2 text-left align-middle sm:table-cell">
                    {name}
                    {row.sub && (
                      <span className="ml-[18px] block text-[11px] font-normal text-slate-500">
                        {row.sub}
                      </span>
                    )}
                  </th>
                  {row.cells.map((cell, i) => (
                    <td
                      key={i}
                      title={cell.note ? `${spec.columns[i]}: ${cell.note}` : undefined}
                      className="relative h-11 rounded-md align-middle sm:h-14"
                      style={{ background: heat(cell.value, span) }}
                    >
                      <span className="whitespace-nowrap text-[11.5px] font-semibold tabular-nums text-white sm:text-[13px]">
                        {cell.value > 0 ? '+' : ''}
                        {cell.value.toFixed(1)}
                      </span>
                      {cell.mark && (
                        <span
                          aria-label="bought"
                          className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-white sm:right-1.5 sm:top-1.5"
                        />
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            )
          })}
        </table>
        <p className="mt-2 px-1 text-right text-[11px] text-slate-500">
          Values in{unit || ' points'}
        </p>
      </div>
    </Figure>
  )
}

export function Ledger({ spec }: { spec: LedgerSpec }) {
  const slots = spec.max ?? Math.max(...spec.rows.map((r) => r.trades.length))
  const biggest = Math.max(...spec.rows.flatMap((r) => r.trades.map((t) => t.size))) || 1
  const outcomes = new Map<string, string | undefined>()
  spec.rows.forEach((r) => r.trades.forEach((t) => outcomes.set(t.outcome, t.color)))
  const legend: LegendItem[] = Array.from(outcomes, ([name, color]) => ({
    name,
    color,
    shape: 'square',
  }))
  const unit = spec.unit ? ` ${spec.unit}` : ''
  return (
    <Figure
      figure={spec.figure}
      title={spec.title}
      subtitle={spec.subtitle}
      source={spec.source}
      legend={legend}
    >
      <div className="space-y-3 px-1">
        {spec.rows.map((row) => {
          const total = row.trades.reduce((s, t) => s + t.size, 0)
          return (
            <div
              key={row.label}
              className="grid grid-cols-[72px_1fr_84px] items-center gap-3 md:grid-cols-[96px_1fr_96px]"
            >
              <span className="flex items-center gap-2 text-[14px] font-semibold text-white">
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: row.color }}
                />
                {row.label}
              </span>
              <div
                className="grid gap-1.5"
                style={{ gridTemplateColumns: `repeat(${slots}, minmax(0, 1fr))` }}
              >
                {Array.from({ length: slots }, (_, i) => {
                  const trade = row.trades[i]
                  if (!trade) {
                    return (
                      <span
                        key={i}
                        className="h-9 rounded-md border border-dashed border-white/10"
                        aria-hidden
                      />
                    )
                  }
                  return (
                    <span
                      key={i}
                      className="flex h-9 items-end"
                      title={`${trade.outcome}: ${trade.size}${unit}`}
                    >
                      <span
                        className="w-full rounded-md"
                        style={{
                          background: trade.color,
                          height: `${Math.max(28, (trade.size / biggest) * 100)}%`,
                        }}
                      />
                    </span>
                  )
                })}
              </div>
              <span className="text-right text-[13px] tabular-nums text-slate-300">
                {total.toFixed(4)}
                <span className="text-slate-500">{unit}</span>
              </span>
            </div>
          )
        })}
      </div>
    </Figure>
  )
}
