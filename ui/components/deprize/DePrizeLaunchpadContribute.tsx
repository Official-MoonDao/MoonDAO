import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import Modal from '@/components/layout/Modal'
import { getChainById } from '@/lib/thirdweb/chain'

const loadContributeModal = () => import('@/components/mission/MissionContributeModal')

const MissionContributeModal = dynamic(loadContributeModal, { ssr: false })

type ContributeProps = {
  mission: {
    id: number
    teamId: number
    projectId: number
    metadata: Record<string, unknown>
  }
  token: Record<string, unknown>
  primaryTerminalAddress: string
  ruleset: [{ weight: string }, { reservedPercent: string }]
}

/**
 * Opens the launchpad contribution modal for the Juicebox project behind a
 * prize pool. Same form, terms checkbox, and payment path as /mission.
 */
export default function DePrizeLaunchpadContribute(props: {
  jbProjectId: number
  chainId: number
  open: boolean
  onClose: () => void
  onFunded?: () => void
}) {
  const [usdInput, setUsdInput] = useState('')
  const [payload, setPayload] = useState<ContributeProps | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadContributeModal()
  }, [])

  useEffect(() => {
    let cancelled = false
    setPayload(null)
    setError(null)
    const url = `/api/mission/contribute-props?projectId=${props.jbProjectId}&chainId=${props.chainId}`
    fetch(url)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body?.error || 'Could not open the contribution')
        return body as ContributeProps
      })
      .then((body) => {
        if (!cancelled) setPayload(body)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not open the contribution')
      })
    return () => {
      cancelled = true
    }
  }, [props.jbProjectId, props.chainId])

  if (!props.open) return null

  if (!payload) {
    return (
      <Modal id="deprize-fund" setEnabled={(v) => !v && props.onClose()} title="Fund the prize">
        <p className="text-sm text-gray-300 px-1 py-2">
          {error || 'Opening the launchpad contribution…'}
        </p>
      </Modal>
    )
  }

  return (
    <MissionContributeModal
      mission={payload.mission}
      token={payload.token}
      modalEnabled
      setModalEnabled={(enabled) => {
        if (!enabled) props.onClose()
      }}
      primaryTerminalAddress={payload.primaryTerminalAddress}
      paymentChain={getChainById(props.chainId)}
      compact
      ruleset={payload.ruleset as any}
      usdInput={usdInput}
      setUsdInput={setUsdInput}
      refreshTotalFunding={props.onFunded}
    />
  )
}
