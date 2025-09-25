import {
  DEFAULT_CHAIN_V5,
  JB_NATIVE_TOKEN_ADDRESS,
  JB_NATIVE_TOKEN_ID,
  ZERO_ADDRESS,
  JBV5_TERMINAL_ADDRESS,
  JBV5_TERMINAL_STORE_ADDRESS,
} from 'const/config'
import { useRouter } from 'next/router'
import JBV5TerminalStore from 'const/abis/JBV5TerminalStore.json'
import useRead from '@/lib/thirdweb/hooks/useRead'
import useContract from '@/lib/thirdweb/hooks/useContract'
import JBV5MultiTerminal from 'const/abis/JBV5MultiTerminal.json'
import { useMemo, useCallback } from 'react'

export default function useTotalFunding(projectId: any) {
  const router = useRouter()
  const jbTerminalContract = useContract({
    address: JBV5_TERMINAL_ADDRESS,
    chain: DEFAULT_CHAIN_V5,
    abi: JBV5MultiTerminal.abi as any,
  })
  const jbTerminalStoreContract = useContract({
    address: JBV5_TERMINAL_STORE_ADDRESS,
    abi: JBV5TerminalStore.abi as any,
    chain: DEFAULT_CHAIN_V5,
  })
  const { data: balance } = useRead({
    contract: jbTerminalStoreContract,
    method: 'balanceOf' as string,
    params: [JBV5_TERMINAL_ADDRESS, projectId, JB_NATIVE_TOKEN_ADDRESS],
  })
  const { data: usedPayoutLimit } = useRead({
    contract: jbTerminalStoreContract,
    method: 'usedPayoutLimitOf' as string,
    params: [
      JBV5_TERMINAL_ADDRESS,
      projectId,
      JB_NATIVE_TOKEN_ADDRESS,
      2, // Cycle number 2 for payout cycle
      JB_NATIVE_TOKEN_ID,
    ],
  })
  const refetch = () => {
    router.reload()
  }

  const totalFunding = useMemo(() => {
    if (projectId == undefined) {
      return BigInt(0)
    }
    return (balance ?? BigInt(0)) + (usedPayoutLimit ?? BigInt(0))
  }, [balance, usedPayoutLimit, projectId])

  return {
    totalFunding,
    refetch,
  }
}
