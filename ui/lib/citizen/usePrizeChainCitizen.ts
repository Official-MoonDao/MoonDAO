import { usePrivy, useWallets } from '@privy-io/react-auth'
import { useEffect, useState } from 'react'
import { useActiveAccount } from 'thirdweb/react'
import { getLinkedEvmAddresses } from '@/lib/privy/linkedEvmAddresses'
import { classifyCitizenProbes } from './citizenGate'
import { probeCitizen } from './probeCitizen'

const MAX_OTHER_WALLETS = 8
const PROBE_ATTEMPTS = 3

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** A blip is not a final answer. Retry before the page asks the user to. */
async function probeUntilSettled(
  chain: { id: number; name?: string },
  owner: string,
  cancelled: () => boolean
) {
  let probe = await probeCitizen(chain, owner)
  for (let attempt = 1; attempt < PROBE_ATTEMPTS && probe.status === 'error'; attempt++) {
    if (cancelled()) return probe
    await wait(400 * 2 ** (attempt - 1))
    if (cancelled()) return probe
    probe = await probeCitizen(chain, owner)
  }
  return probe
}

type SettledCitizen = {
  key: string
  isCitizen: boolean
  lookupFailed: boolean
  expired: boolean
  linkedCitizenAddress?: string
  tokenId?: string
}

function otherWalletKey(addresses: readonly string[], active: string): string {
  const unique = new Set(
    addresses
      .map((address) => address.toLowerCase())
      .filter((address) => address && address !== active)
  )
  return Array.from(unique).sort().slice(0, MAX_OTHER_WALLETS).join(',')
}

/**
 * Citizen check for a prize chain. The active signer is the only wallet that
 * can save a prediction. Other Privy wallets are checked so a Citizen on a
 * linked wallet is not told to mint.
 */
export function usePrizeChainCitizen(chain?: { id: number; name?: string }) {
  const account = useActiveAccount()
  const { user, ready } = usePrivy()
  const { wallets } = useWallets()
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<SettledCitizen | null>(null)

  const active = account?.address?.toLowerCase() || ''
  const otherKey = otherWalletKey(
    [
      ...getLinkedEvmAddresses(user, account?.address),
      ...(wallets ?? []).map((wallet) => wallet.address || ''),
    ],
    active
  )
  const requestKey = `${chain?.id ?? ''}|${active}|${otherKey}|${attempt}`

  useEffect(() => {
    if (!chain?.id || !active) {
      setResult(null)
      return
    }
    // Wait until Privy has finished restoring linked wallets. Settling early
    // marks the embedded signer as "not a citizen" before the wallet that
    // actually holds the Citizen is in the list.
    if (!ready) return

    const owners = otherKey ? otherKey.split(',') : []
    let cancelled = false
    const key = requestKey
    const isCancelled = () => cancelled

    void (async () => {
      const probes = await Promise.all([
        probeUntilSettled(chain, active, isCancelled),
        ...owners.map((address) => probeUntilSettled(chain, address, isCancelled)),
      ])
      if (cancelled) return
      const activeProbe = probes[0]
      const classified = classifyCitizenProbes({
        active: activeProbe.status,
        others: owners.map((address, index) => ({
          address,
          status: probes[index + 1].status,
        })),
      })
      setResult({
        key,
        ...classified,
        tokenId: activeProbe.status === 'citizen' ? activeProbe.tokenId : undefined,
      })
    })()

    return () => {
      cancelled = true
    }
  }, [active, otherKey, ready, requestKey])

  const settled = result?.key === requestKey && !!active && !!chain?.id && ready
  return {
    isCitizen: settled ? result.isCitizen : false,
    isLoading: !!active && !!chain?.id && !settled,
    lookupFailed: settled ? result.lookupFailed : false,
    expired: settled ? result.expired : false,
    linkedCitizenAddress: settled ? result.linkedCitizenAddress : undefined,
    tokenId: settled ? result.tokenId : undefined,
    retry: () => setAttempt((n) => n + 1),
  }
}
