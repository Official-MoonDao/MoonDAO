import ProjectTableABI from 'const/abis/ProjectTable.json'
import {
  DEFAULT_CHAIN_V5,
  PROJECT_TABLE_ADDRESSES,
} from 'const/config'
import { utils } from 'ethers'
import { isOperator } from 'middleware/isOperator'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getHSMSigner, isHSMAvailable } from '@/lib/google/hsm-signer'
import { getChainSlug } from '@/lib/thirdweb/chain'

type Body = {
  projectId: number | string
  finalReportLink?: string
  finalReportIPFS?: string
  rewardDistribution?: Record<string, number> | string
  upfrontPayments?: Record<string, any> | string
  markEligible?: boolean
  markActive?: boolean
}

// Owner-only contract operations needed to put a completed project into the
// retroactive rewards pool. The contract owner is the GCP HSM signer EOA, so
// this route signs every call with `getHSMSigner()`.
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!isHSMAvailable()) {
    return res.status(500).json({
      error:
        'HSM signer not available. Set GCP_SIGNER_SERVICE_ACCOUNT and GCP_PROJECT_ID.',
    })
  }

  const body = (req.body ?? {}) as Body
  const projectId = Number(body.projectId)
  if (!Number.isInteger(projectId) || projectId < 0) {
    return res.status(400).json({ error: 'projectId must be a non-negative integer' })
  }

  const chain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(chain)
  const projectTableAddress = PROJECT_TABLE_ADDRESSES[chainSlug]
  if (!projectTableAddress) {
    return res.status(500).json({ error: `No project table address for chain ${chainSlug}` })
  }

  const iface = new utils.Interface(ProjectTableABI as any)

  // Coerce a `string | object` body field into a canonical JSON string,
  // rejecting payloads that aren't valid JSON or aren't an object/array at
  // the top level. This prevents callers (or anyone bypassing the modal's
  // client-side validation) from writing malformed data on-chain that
  // downstream `JSON.parse` consumers would crash on.
  const normalizeJsonField = (
    field: 'rewardDistribution' | 'upfrontPayments',
    raw: unknown
  ): { ok: true; json: string } | { ok: false; error: string } => {
    if (raw === null || raw === undefined) {
      return { ok: false, error: `${field} is empty` }
    }
    if (typeof raw === 'string') {
      const trimmed = raw.trim()
      if (!trimmed) return { ok: false, error: `${field} is empty` }
      let parsed: unknown
      try {
        parsed = JSON.parse(trimmed)
      } catch (err: any) {
        return {
          ok: false,
          error: `${field} is not valid JSON: ${err?.message || 'parse error'}`,
        }
      }
      if (parsed === null || typeof parsed !== 'object') {
        return {
          ok: false,
          error: `${field} must be a JSON object or array`,
        }
      }
      return { ok: true, json: JSON.stringify(parsed) }
    }
    if (typeof raw === 'object') {
      try {
        return { ok: true, json: JSON.stringify(raw) }
      } catch (err: any) {
        return {
          ok: false,
          error: `${field} could not be serialized: ${err?.message || 'serialize error'}`,
        }
      }
    }
    return {
      ok: false,
      error: `${field} must be a JSON object/array or a JSON-encoded string`,
    }
  }

  const calls: Array<{ label: string; data: string }> = []

  if (body.finalReportLink) {
    calls.push({
      label: 'updateFinalReportLink',
      data: iface.encodeFunctionData('updateFinalReportLink', [
        projectId,
        body.finalReportLink,
      ]),
    })
  }

  if (body.finalReportIPFS) {
    calls.push({
      label: 'updateFinalReportIPFS',
      data: iface.encodeFunctionData('updateFinalReportIPFS', [
        projectId,
        body.finalReportIPFS,
      ]),
    })
  }

  if (body.rewardDistribution !== undefined) {
    const result = normalizeJsonField(
      'rewardDistribution',
      body.rewardDistribution
    )
    if (!result.ok) {
      return res.status(400).json({ error: result.error })
    }
    calls.push({
      label: 'updateRewardDistribution',
      data: iface.encodeFunctionData('updateRewardDistribution', [
        projectId,
        result.json,
      ]),
    })
  }

  if (body.upfrontPayments !== undefined) {
    const result = normalizeJsonField('upfrontPayments', body.upfrontPayments)
    if (!result.ok) {
      return res.status(400).json({ error: result.error })
    }
    calls.push({
      label: 'updateTableCol(upfrontPayments)',
      data: iface.encodeFunctionData('updateTableCol', [
        projectId,
        'upfrontPayments',
        result.json,
      ]),
    })
  }

  if (body.markEligible) {
    calls.push({
      label: 'updateTableCol(eligible=1)',
      data: iface.encodeFunctionData('updateTableCol', [projectId, 'eligible', '1']),
    })
  }

  if (body.markActive) {
    calls.push({
      label: 'updateTableCol(active=2)',
      data: iface.encodeFunctionData('updateTableCol', [projectId, 'active', '2']),
    })
  }

  if (calls.length === 0) {
    return res.status(400).json({ error: 'Nothing to do — no fields supplied' })
  }

  const signer = getHSMSigner()

  const txs: Array<{ label: string; hash: string }> = []
  try {
    for (const call of calls) {
      const result = await signer.sendTransaction({
        to: projectTableAddress,
        data: call.data,
      })
      const hash = result?.transactionHash || result?.hash
      if (!hash) {
        throw new Error(`No tx hash returned for ${call.label}`)
      }
      txs.push({ label: call.label, hash })
    }
  } catch (err: any) {
    console.error('project-add-to-retroactives failed:', err)
    return res.status(500).json({
      error: err?.message || 'Unknown error sending operator transactions',
      submittedTxs: txs,
    })
  }

  return res.status(200).json({
    success: true,
    projectId,
    txs,
  })
}

export default withMiddleware(handler, isOperator)
