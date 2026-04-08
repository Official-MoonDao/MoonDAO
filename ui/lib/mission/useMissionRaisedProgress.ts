import { useMemo } from 'react'
import { formatUnits } from 'ethers/lib/utils'
import {
  getMissionOffChainCommittedUsd,
  MISSION_FUNDING_MILESTONES_USD,
} from 'const/missionMilestones'
import useETHPrice from '@/lib/etherscan/useETHPrice'
import useTotalFunding from '@/lib/juicebox/useTotalFunding'
import { milestoneSegmentProgress, formatUsdCompact } from './milestoneProgress'

/** Juicebox subgraph `volume` is string | number; cumulative pay-in wei. */
export function jbSubgraphVolumeToBigIntWei(volume: unknown): bigint {
  if (volume == null || volume === '') return BigInt(0)
  try {
    if (typeof volume === 'bigint') {
      return volume
    }
    if (typeof volume === 'number') {
      if (!Number.isFinite(volume)) return BigInt(0)
      const truncated = Math.trunc(volume)
      if (Number.isSafeInteger(truncated) && truncated >= 0) {
        return BigInt(truncated)
      }
    }
    const s = String(volume).trim()
    const match = /^(\d+)(?:[eE]([+-]?\d+))?$/.exec(s)
    if (!match) return BigInt(0)
    const intPart = match[1]
    const expPart = match[2]
    if (!expPart) {
      return BigInt(intPart)
    }
    const exp = Number(expPart)
    if (!Number.isInteger(exp) || exp < 0) return BigInt(0)
    const zeros = '0'.repeat(exp)
    return BigInt(intPart + zeros)
  } catch {
    return BigInt(0)
  }
}

export function weiBigintToEthNumber(wei: bigint): number {
  if (wei === BigInt(0)) return 0
  return parseFloat(formatUnits(wei.toString(), 18))
}

export interface MissionRaisedProgress {
  onChainEthRaised: number
  offChainCommittedUsd: number
  raisedUsd: number | null
  milestoneProgressPercent: number | null
  milestoneCaption: string | null
  ethPrice: number | null
  isLoading: boolean
}

/**
 * Single source of truth for "total raised" and "milestone progress" across
 * the mission page, featured-mission section, and dashboard.
 *
 * Combines on-chain funding (max of terminal-store balance and subgraph volume)
 * with off-chain committed USD, and computes milestone-segment progress.
 */
export default function useMissionRaisedProgress({
  projectId,
  missionId,
  subgraphVolume,
}: {
  projectId: number | undefined
  missionId: number | string | undefined
  subgraphVolume: unknown
}): MissionRaisedProgress {
  const { totalFunding, isLoading: isLoadingTotalFunding } =
    useTotalFunding(projectId)
  const { ethPrice } = useETHPrice(1, 'ETH_TO_USD')

  return useMemo(() => {
    const offChainCommittedUsd = getMissionOffChainCommittedUsd(missionId)
    const terminalWei = totalFunding ?? BigInt(0)
    const subgraphWei = jbSubgraphVolumeToBigIntWei(subgraphVolume)
    const onChainRaisedWei =
      terminalWei >= subgraphWei ? terminalWei : subgraphWei
    const onChainEthRaised = weiBigintToEthNumber(onChainRaisedWei)

    const isLoading = isLoadingTotalFunding || !ethPrice || ethPrice <= 0
    const raisedUsd = isLoading
      ? null
      : onChainEthRaised * ethPrice! + offChainCommittedUsd

    const numId =
      missionId !== undefined && missionId !== null ? Number(missionId) : NaN
    const steps = Number.isFinite(numId)
      ? MISSION_FUNDING_MILESTONES_USD[numId]
      : undefined

    let milestoneProgressPercent: number | null = null
    let milestoneCaption: string | null = null

    if (steps?.length && raisedUsd != null) {
      const seg = milestoneSegmentProgress(raisedUsd, steps)
      milestoneProgressPercent = seg.progressPercent
      milestoneCaption = seg.allMilestonesComplete
        ? 'All milestones below are unlocked. Funding continues toward the full campaign goal.'
        : `Toward the ${formatUsdCompact(seg.segmentEndUsd)} milestone · ${formatUsdCompact(
            Math.max(0, seg.segmentEndUsd - raisedUsd)
          )} to go`
    }

    return {
      onChainEthRaised,
      offChainCommittedUsd,
      raisedUsd,
      milestoneProgressPercent,
      milestoneCaption,
      ethPrice,
      isLoading,
    }
  }, [
    totalFunding,
    subgraphVolume,
    missionId,
    isLoadingTotalFunding,
    ethPrice,
  ])
}
