import {
  DEFAULT_CHAIN_V5,
  JB_NATIVE_TOKEN_ADDRESS,
  JB_NATIVE_TOKEN_ID,
} from 'const/config'
import {
  useJBTerminalContext,
  useReadJbTerminalStoreBalanceOf,
  useReadJbDirectoryPrimaryTerminalOf,
  useReadJbTerminalStoreUsedPayoutLimitOf,
} from 'juice-sdk-react'

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
  const { data: terminalAddress } = useReadJbDirectoryPrimaryTerminalOf({
    chainId: chainId as SupportedChainId,
    args: [projectId ?? 0, JB_NATIVE_TOKEN_ADDRESS],
  })
  const { store } = useJBTerminalContext()
  const { data: balance } = useReadJbTerminalStoreBalanceOf({
    address: store.data ?? undefined,
    chainId,
    args: [terminalAddress, projectId, JB_NATIVE_TOKEN_ADDRESS],
  })
  const { data: usedPayoutLimit, isLoading } =
    useReadJbTerminalStoreUsedPayoutLimitOf({
      address: store.data ?? undefined,
      chainId,
      args: [
        terminalAddress,
        projectId ?? 0n,
        JB_NATIVE_TOKEN_ADDRESS,
        BigInt(2), // Cycle number 2 for payout cycle
        BigInt(JB_NATIVE_TOKEN_ID),
      ],
    })

  const totalFunding = balance + usedPayoutLimit
  return totalFunding
}
