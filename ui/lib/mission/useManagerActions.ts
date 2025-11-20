import JBV5Controller from 'const/abis/JBV5Controller.json'
import JBV5MultiTerminal from 'const/abis/JBV5MultiTerminal.json'
import JBV5TerminalStore from 'const/abis/JBV5TerminalStore.json'
import PoolDeployerABI from 'const/abis/PoolDeployer.json'
import {
  JBV5_CONTROLLER_ADDRESS,
  JBV5_TERMINAL_ADDRESS,
  JB_NATIVE_TOKEN_ADDRESS,
  JB_NATIVE_TOKEN_ID,
} from 'const/config'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { getContract, prepareContractCall, readContract, sendAndConfirmTransaction } from 'thirdweb'
import type { Chain } from 'thirdweb/chains'
import { useActiveAccount } from 'thirdweb/react'
import { serverClient } from '../thirdweb/client'

type Mission = {
  projectId: number
  [key: string]: any
}

type UseManagerActionsReturn = {
  availableTokens: number
  availablePayouts: number
  sendReservedTokens: () => Promise<void>
  sendPayouts: () => Promise<void>
  deployLiquidityPool: () => Promise<void>
}

/**
 * Hook for manager-specific actions on a mission
 * Fetches available tokens/payouts and provides functions to distribute them
 */
export function useManagerActions(
  mission: Mission | undefined,
  selectedChain: Chain,
  poolDeployerAddress?: string
): UseManagerActionsReturn {
  const account = useActiveAccount()
  const [availableTokens, setAvailableTokens] = useState<number>(0)
  const [availablePayouts, setAvailablePayouts] = useState<number>(0)

  const jbControllerContract = getContract({
    client: serverClient,
    address: JBV5_CONTROLLER_ADDRESS,
    abi: JBV5Controller.abi as any,
    chain: selectedChain,
  })

  const jbTerminalContract = getContract({
    client: serverClient,
    address: JBV5_TERMINAL_ADDRESS,
    abi: JBV5MultiTerminal.abi as any,
    chain: selectedChain,
  })

  useEffect(() => {
    async function fetchAvailableAmounts() {
      if (mission?.projectId === undefined || mission?.projectId === null) return

      try {
        // Get available payouts
        const storeAddress: any = await readContract({
          contract: jbTerminalContract,
          method: 'STORE' as string,
          params: [],
        })

        const jbTerminalStoreContract = getContract({
          client: serverClient,
          address: storeAddress,
          abi: JBV5TerminalStore.abi as any,
          chain: selectedChain,
        })

        const balance: any = await readContract({
          contract: jbTerminalStoreContract,
          method: 'balanceOf' as string,
          params: [jbTerminalContract.address, mission.projectId, JB_NATIVE_TOKEN_ADDRESS],
        })

        setAvailablePayouts(+balance.toString())

        const reservedTokenBalance: any = await readContract({
          contract: jbControllerContract,
          method: 'pendingReservedTokenBalanceOf' as string,
          params: [mission.projectId],
        })

        setAvailableTokens(+reservedTokenBalance.toString())
      } catch (err: any) {
        console.error('Error fetching available amounts:', err)
      }
    }

    if (mission?.projectId) {
      fetchAvailableAmounts()
    }
  }, [mission?.projectId, selectedChain, jbTerminalContract, jbControllerContract])

  const sendReservedTokens = async () => {
    if (!account || !mission?.projectId) return

    try {
      const tx = prepareContractCall({
        contract: jbControllerContract,
        method: 'sendReservedTokensToSplitsOf' as string,
        params: [mission.projectId],
      })

      await sendAndConfirmTransaction({ transaction: tx, account })
      toast.success('Tokens sent.')
    } catch (err: any) {
      console.error('Token distribution error:', err)
      toast.error('No tokens to send.')
    }
  }

  const sendPayouts = async () => {
    if (!account || !mission?.projectId) return

    try {
      const storeAddress: any = await readContract({
        contract: jbTerminalContract,
        method: 'STORE' as string,
        params: [],
      })

      const jbTerminalStoreContract = getContract({
        client: serverClient,
        address: storeAddress,
        abi: JBV5TerminalStore.abi as any,
        chain: selectedChain,
      })

      const balance: any = await readContract({
        contract: jbTerminalStoreContract,
        method: 'balanceOf' as string,
        params: [jbTerminalContract.address, mission.projectId, JB_NATIVE_TOKEN_ADDRESS],
      })

      const tx = prepareContractCall({
        contract: jbTerminalContract,
        method: 'sendPayoutsOf' as string,
        params: [mission.projectId, JB_NATIVE_TOKEN_ADDRESS, balance, JB_NATIVE_TOKEN_ID, 0],
      })

      await sendAndConfirmTransaction({ transaction: tx, account })
      toast.success('Payouts sent.')
    } catch (err: any) {
      console.error('Payout distribution error:', err)
      toast.error('No payouts to send.')
    }
  }

  const deployLiquidityPool = async () => {
    if (!account || !poolDeployerAddress) return

    const poolDeployerContract = getContract({
      client: serverClient,
      address: poolDeployerAddress,
      abi: PoolDeployerABI as any,
      chain: selectedChain,
    })

    try {
      const tx = prepareContractCall({
        contract: poolDeployerContract,
        method: 'createAndAddLiquidity' as string,
        params: [],
      })

      await sendAndConfirmTransaction({ transaction: tx, account })
      toast.success('Liquidity pool deployed.')
    } catch (err: any) {
      console.error('Liquidity deployment error:', err)
      toast.error('Failed to deploy liquidity pool.')
    }
  }

  return {
    availableTokens,
    availablePayouts,
    sendReservedTokens,
    sendPayouts,
    deployLiquidityPool,
  }
}
