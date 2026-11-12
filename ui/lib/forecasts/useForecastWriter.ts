import {
  useCreateWallet,
  useGuestAccounts,
  useLogin,
  useLogout,
  usePrivy,
  useSendTransaction,
  useWallets,
} from '@privy-io/react-auth'
import ForecastsTableABI from 'const/abis/Forecasts.json'
import { FORECASTS_TABLE_ADDRESSES, FORECASTS_TABLE_NAMES } from 'const/config'
import { useCallback, useMemo, useRef } from 'react'
import toast from 'react-hot-toast'
import { getContract } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import type { Account } from 'thirdweb/wallets'
import { clearForecastVote } from '@/lib/deprize/writeForecastVote'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import { withClientFeeOverrides } from '@/lib/rpc/eip1559Fees'
import { tablelandQueryEndpoint } from '@/lib/tableland/endpoint'
import { v4SlugToV5Chain } from '@/lib/thirdweb/chain'
import client from '@/lib/thirdweb/client'
import { guestForecastAccount } from './guestAccount'
import {
  mergePendingHandoffs,
  readPendingHandoffs,
  writePendingHandoffs,
  type PendingHandoff,
} from './guestHandoff'

const GUEST_WALLET_WAIT_MS = 15_000

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * The wallet a forecast is written from. A signed-in visitor uses the site's
 * active wallet. A signed-out visitor gets a Privy guest account on their
 * first Predict: no login screen and no confirmation screen. The guest wallet
 * is never made the site's active wallet, so the rest of the site still
 * treats that visitor as signed out.
 */
export function useForecastWriter() {
  const account = useActiveAccount()
  const { ready, authenticated, user } = usePrivy()
  const { createGuestAccount } = useGuestAccounts()
  const { createWallet } = useCreateWallet()
  const { wallets } = useWallets()
  const { sendTransaction } = useSendTransaction()
  const { logout } = useLogout()
  const { login } = useLogin()
  const isGuest = !!user?.isGuest

  const walletsRef = useRef(wallets)
  walletsRef.current = wallets
  const sendRef = useRef(sendTransaction)
  sendRef.current = sendTransaction

  const makeGuestAccount = useCallback(
    (address: string) =>
      guestForecastAccount(address, async (tx) => {
        const withFees = await withClientFeeOverrides(tx, tx.chainId)
        return sendRef.current(withFees, {
          address,
          uiOptions: { showWalletUIs: false },
        })
      }),
    []
  )

  const guestAddress = isGuest
    ? wallets.find((wallet) => wallet.walletClientType === 'privy')?.address
    : undefined
  const guestAccount = useMemo(
    () => (guestAddress ? makeGuestAccount(guestAddress) : undefined),
    [guestAddress, makeGuestAccount]
  )
  const writer: Account | undefined = account ?? guestAccount

  /**
   * Returns a wallet that can write, creating a guest account when the
   * visitor is signed out. Null means the caller should fall back to login:
   * guests are off in Privy, or a signed-in wallet is still attaching.
   */
  const ensureWriter = useCallback(async (): Promise<Account | null> => {
    if (writer) return writer
    if (!ready || (authenticated && !isGuest)) return null
    try {
      const guest = await createGuestAccount()
      let address = guest.wallet?.address
      if (!address) {
        address = await createWallet()
          .then((wallet) => wallet.address)
          .catch(() => undefined)
      }
      const deadline = Date.now() + GUEST_WALLET_WAIT_MS
      while (Date.now() < deadline) {
        const embedded = walletsRef.current.find(
          (wallet) =>
            wallet.walletClientType === 'privy' &&
            (!address || wallet.address.toLowerCase() === address.toLowerCase())
        )
        if (embedded) return makeGuestAccount(embedded.address)
        await sleep(250)
      }
      return null
    } catch (err) {
      console.warn('[forecast] guest account unavailable', err)
      return null
    }
  }, [authenticated, createGuestAccount, createWallet, isGuest, makeGuestAccount, ready, writer])

  /**
   * Privy cannot merge a guest into an existing account. Copy the guest's
   * forecasts, delete them, then drop the guest and sign in. The prize page
   * writes them again from the account's wallet. A failed read or delete
   * leaves the guest signed in — that wallet is the only way back to a
   * forecast that never made it into the handoff.
   */
  const switchToExistingAccount = useCallback(async () => {
    if (!guestAccount) {
      login()
      return
    }

    const keepGuest = (err?: unknown) => {
      console.warn('[forecast] could not move a guest forecast', err)
      toast.error('Could not move your prediction yet. You are still on this guest session.', {
        style: toastStyle,
      })
    }

    const found: PendingHandoff[] = []
    for (const chainSlug of Object.keys(FORECASTS_TABLE_NAMES)) {
      const tableName = FORECASTS_TABLE_NAMES[chainSlug]
      const tableAddress = FORECASTS_TABLE_ADDRESSES[chainSlug]
      const chain = v4SlugToV5Chain(chainSlug)
      if (!tableName || !tableAddress || !chain) continue
      try {
        const statement = `SELECT voteId, vote FROM ${tableName} WHERE address = '${guestAccount.address.toLowerCase()}'`
        const res = await fetch(
          `${tablelandQueryEndpoint(chain.id)}?statement=${encodeURIComponent(statement)}`
        )
        if (!res.ok) {
          keepGuest(res.status)
          return
        }
        const rows = await res.json()
        if (!Array.isArray(rows)) {
          keepGuest(rows)
          return
        }
        for (const row of rows) {
          const voteId = Number(row?.voteId)
          if (!Number.isInteger(voteId)) continue
          const vote = typeof row.vote === 'string' ? row.vote : JSON.stringify(row.vote)
          found.push({ chainSlug, deprizeId: voteId, vote })
        }
      } catch (err) {
        keepGuest(err)
        return
      }
    }

    // Snapshot before any delete. A later delete can fail once the stipend
    // is spent; the copy has to exist before the guest wallet is dropped.
    const stored = writePendingHandoffs(mergePendingHandoffs(readPendingHandoffs(), found))
    if (found.length > 0 && !stored) {
      keepGuest('handoff store unavailable')
      return
    }

    try {
      for (const row of found) {
        const chain = v4SlugToV5Chain(row.chainSlug)
        const tableAddress = FORECASTS_TABLE_ADDRESSES[row.chainSlug]
        if (!chain || !tableAddress) {
          keepGuest(`missing forecasts table for ${row.chainSlug}`)
          return
        }
        const contract = getContract({
          client,
          chain,
          address: tableAddress,
          abi: ForecastsTableABI.abi as any,
        })
        // A guest row left behind would count this visitor twice.
        await clearForecastVote({
          forecastsContract: contract,
          account: guestAccount,
          voteId: row.deprizeId,
        })
      }
    } catch (err) {
      keepGuest(err)
      return
    }

    if (found.length > 0) {
      toast('Sign in and your prediction moves to your account.', { style: toastStyle })
    }
    await logout()
    login()
  }, [guestAccount, login, logout])

  return { writer, isGuest, ensureWriter, switchToExistingAccount, login }
}
