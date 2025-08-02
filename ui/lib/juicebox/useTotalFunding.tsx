import {
  DEFAULT_CHAIN_V5,
  JB_NATIVE_TOKEN_ADDRESS,
  JB_NATIVE_TOKEN_ID,
  ZERO_ADDRESS,
} from 'const/config'
import {
  useJBTerminalContext,
  useReadJbTerminalStoreBalanceOf,
  useReadJbDirectoryPrimaryTerminalOf,
  useReadJbTerminalStoreUsedPayoutLimitOf,
} from 'juice-sdk-react'
import { useMemo, useCallback } from 'react'

export default function useTotalFunding(projectId: any) {
  const chainId = DEFAULT_CHAIN_V5.id
  type SupportedChainId =
    | 1
    | 10
    | 42161
    | 8453
    | 84532
    | 421614
    | 11155111
    | 11155420

  const { data: terminalAddress, refetch: refetchTerminal } =
    useReadJbDirectoryPrimaryTerminalOf({
      chainId: chainId as SupportedChainId,
      args: [projectId ?? 0, JB_NATIVE_TOKEN_ADDRESS],
    })

  const { store } = useJBTerminalContext()

  const { data: balance, refetch: refetchBalance } =
    useReadJbTerminalStoreBalanceOf({
      address: store.data ?? undefined,
      chainId,
      args: [
        terminalAddress ?? ZERO_ADDRESS,
        projectId,
        JB_NATIVE_TOKEN_ADDRESS,
      ],
    })

  const {
    data: usedPayoutLimit,
    isLoading,
    refetch: refetchPayoutLimit,
  } = useReadJbTerminalStoreUsedPayoutLimitOf({
    address: store.data ?? undefined,
    chainId,
    args: [
      terminalAddress ?? ZERO_ADDRESS,
      projectId ?? 0,
      JB_NATIVE_TOKEN_ADDRESS,
      BigInt(2), // Cycle number 2 for payout cycle
      BigInt(JB_NATIVE_TOKEN_ID),
    ],
  })

  const totalFunding = useMemo(() => {
    if (projectId == undefined) {
      return BigInt(0)
    }
    return (balance ?? BigInt(0)) + (usedPayoutLimit ?? BigInt(0))
  }, [balance, usedPayoutLimit, projectId])

  const refetch = useCallback(async () => {
    console.log('refetching total funding for project:', projectId)

    if (!projectId) {
      console.log('No projectId provided, skipping refetch')
      return
    }

    try {
      const refetchPromises = []

      if (refetchTerminal) refetchPromises.push(refetchTerminal())
      if (refetchBalance) refetchPromises.push(refetchBalance())
      if (refetchPayoutLimit) refetchPromises.push(refetchPayoutLimit())

      if (refetchPromises.length > 0) {
        await Promise.all(refetchPromises)
      }
    } catch (error) {
      console.error('Error refetching total funding:', error)
    }
  }, [projectId, refetchTerminal, refetchBalance, refetchPayoutLimit])

  return {
    totalFunding,
    isLoading,
    refetch,
  }
}
