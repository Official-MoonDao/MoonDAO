// Live event ledger: shows the Campfire interaction events as they happen,
// newest first. This is the "show, don't tell" view of trustless settlement.

import { useMemo } from 'react'
import type { SimEvent, SimEventType } from '@/lib/lunar-sim/engine/types'
import type { UseSimulationResult } from '@/lib/lunar-sim/useSimulation'

type LedgerPanelProps = {
  sim: UseSimulationResult
}

// Movement spam is filtered out; these are the meaningful protocol events.
const SHOWN: Record<string, { label: string; tone: string }> = {
  HandshakeStarted: { label: 'Handshake', tone: 'text-sky-300' },
  HandshakeSucceeded: { label: 'Identity OK', tone: 'text-emerald-300' },
  HandshakeFailed: { label: 'Identity fail', tone: 'text-red-300' },
  CredentialChecked: { label: 'SOAR lookup', tone: 'text-sky-300' },
  CredentialRejected: { label: 'Credential fail', tone: 'text-red-300' },
  StandardMatched: { label: 'Standard OK', tone: 'text-emerald-300' },
  StandardMismatch: { label: 'Standard fail', tone: 'text-red-300' },
  TransactionProposed: { label: 'Proposed', tone: 'text-amber-300' },
  TransactionSigned: { label: 'Signed', tone: 'text-emerald-300' },
  TransactionRejected: { label: 'Rejected', tone: 'text-red-300' },
  AllowanceReduced: { label: 'Allowance', tone: 'text-white/60' },
  CommunicationWindowOpened: { label: 'Comms', tone: 'text-cyan-300' },
  TransactionCacheFlushed: { label: 'Flush', tone: 'text-cyan-300' },
  SettlementCompleted: { label: 'Settled', tone: 'text-emerald-300' },
}

const HIDDEN: SimEventType[] = ['AssetMoved', 'ResourceExtracted']

export default function LedgerPanel({ sim }: LedgerPanelProps) {
  const rows = useMemo(() => {
    return sim.eventsUpToTick
      .filter((e) => !HIDDEN.includes(e.type))
      .slice(-120)
      .reverse()
  }, [sim.eventsUpToTick])

  return (
    <div className="pointer-events-auto flex h-full flex-col rounded-2xl border border-white/10 bg-black/60 backdrop-blur-md">
      <div className="border-b border-white/10 px-4 py-3">
        <h3 className="text-sm font-semibold text-white">Transaction Ledger</h3>
        <p className="text-xs text-white/40">
          Signed receipts and protocol events
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {rows.length === 0 && (
          <p className="px-2 py-4 text-xs text-white/40">
            No events yet. Press play to run the scenario.
          </p>
        )}
        {rows.map((e: SimEvent, i) => {
          const meta = SHOWN[e.type] || { label: e.type, tone: 'text-white/60' }
          return (
            <div
              key={`${e.tick}-${i}`}
              className="flex gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5"
            >
              <span className="w-12 shrink-0 font-mono text-[10px] text-white/30">
                {e.timeSec}s
              </span>
              <span className={`w-24 shrink-0 text-[11px] font-medium ${meta.tone}`}>
                {meta.label}
              </span>
              <span className="text-[11px] leading-tight text-white/70">
                {e.message}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
