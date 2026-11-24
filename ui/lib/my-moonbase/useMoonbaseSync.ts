import { useCallback, useEffect, useRef, useState } from 'react'
import { sanitizeLayout, type ItemKind, type MoonbaseLayout } from './grid'
import { isBaseId } from './share'
import { parseSyncMeta, reconcile, sameLayout, type SavedBase, type SyncMeta } from './sync'

export const SYNC_STORAGE_KEY = 'my-moonbase:sync:v1'

/** Quiet time after the last edit before it is sent. */
const SAVE_DELAY_MS = 2_000
const RETRY_MS = 20_000
const RETRY_MAX_MS = 5 * 60_000
const REFOCUS_MIN_MS = 20_000
/** Browsers refuse a keepalive request with a larger body. */
const KEEPALIVE_MAX_BYTES = 60_000

export type BaseSyncStatus =
  /** No wallet to save under. The base lives in this browser only. */
  | 'local'
  /** Reading the copy saved to the account. */
  | 'checking'
  | 'saving'
  /** The account holds what is on screen, or there is nothing to save yet. */
  | 'saved'
  /** The account holds a different base. The visitor has to pick one. */
  | 'conflict'
  /** A read or a save failed. It is retried. */
  | 'error'
  /** This server has no store for bases. Browser only, and no retry. */
  | 'unavailable'

type Reply = { status: number; body: any }

async function request(
  getToken: () => Promise<string | null>,
  method: 'GET' | 'PUT',
  wallet: string,
  payload?: Record<string, unknown>,
  keepalive = false
): Promise<Reply> {
  const body = payload ? JSON.stringify({ wallet, ...payload }) : undefined
  const send = async (): Promise<Reply> => {
    const token = await getToken().catch(() => null)
    try {
      const res = await fetch(
        method === 'GET' ? `/api/moonbase/base?wallet=${wallet}` : '/api/moonbase/base',
        {
          method,
          headers: {
            ...(body ? { 'Content-Type': 'application/json' } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body,
          keepalive: keepalive && (body?.length ?? 0) < KEEPALIVE_MAX_BYTES,
        }
      )
      return { status: res.status, body: await res.json().catch(() => null) }
    } catch {
      return { status: 0, body: null }
    }
  }
  const first = await send()
  // An access token that expired in flight. The second ask gets a fresh one.
  return first.status === 401 ? send() : first
}

/** The share id of the base last saved from this browser, if any. */
export function readStoredShareId(): string | null {
  try {
    const meta = parseSyncMeta(JSON.parse(window.localStorage.getItem(SYNC_STORAGE_KEY) ?? 'null'))
    return meta && isBaseId(meta.shareId) ? meta.shareId : null
  } catch {
    return null
  }
}

/**
 * Keeps the base in this browser and the copy saved to the visitor's account
 * in step: reads the account copy once a wallet is known, saves a moment
 * after each edit, and stops to ask when the two have diverged.
 *
 * `address` is the wallet predictions are saved from, so a base and the
 * predictions it is built on always belong to the same account.
 */
export function useMoonbaseSync(input: {
  layout: MoonbaseLayout
  /** The browser's own copy has been read. */
  loaded: boolean
  address: string | undefined
  /** False while the session is still resolving, when `address` means nothing yet. */
  identityReady: boolean
  getToken: () => Promise<string | null>
  spanFor: (kind: ItemKind, ref: string) => number | undefined
  /** Swaps another layout into the editor. */
  replace: (layout: MoonbaseLayout) => void
}) {
  const { layout, loaded, identityReady } = input
  const wallet = input.address?.toLowerCase()

  const [status, setStatusState] = useState<BaseSyncStatus>('local')
  const [shareId, setShareId] = useState<string | null>(null)
  const [conflict, setConflict] = useState<SavedBase | null>(null)
  const [attempt, setAttempt] = useState(0)

  const statusRef = useRef(status)
  const setStatus = useCallback((next: BaseSyncStatus) => {
    statusRef.current = next
    setStatusState(next)
  }, [])
  const layoutRef = useRef(layout)
  layoutRef.current = layout
  const walletRef = useRef(wallet)
  walletRef.current = wallet
  const inputRef = useRef(input)
  inputRef.current = input
  const conflictRef = useRef(conflict)
  conflictRef.current = conflict

  const metaRef = useRef<SyncMeta | null | undefined>(undefined)
  /** Wallet whose account copy has been compared with this browser's. */
  const reconciledRef = useRef<string | null>(null)
  /** `updatedAt` of the account copy as last seen. Null when there is none. */
  const versionRef = useRef<number | null>(null)
  /** The layout object the account copy is known to match. */
  const syncedRef = useRef<MoonbaseLayout | null>(null)
  /** A layout this hook swapped in, which is therefore not an edit. */
  const adoptedRef = useRef<MoonbaseLayout | null>(null)
  const previousRef = useRef<MoonbaseLayout | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout>>()
  const retryTimer = useRef<ReturnType<typeof setTimeout>>()
  const failures = useRef(0)
  const queue = useRef<Promise<unknown>>(Promise.resolve())

  const readMeta = useCallback((): SyncMeta | null => {
    if (metaRef.current === undefined) {
      try {
        metaRef.current = parseSyncMeta(
          JSON.parse(window.localStorage.getItem(SYNC_STORAGE_KEY) ?? 'null')
        )
      } catch {
        metaRef.current = null
      }
    }
    return metaRef.current
  }, [])

  const writeMeta = useCallback((meta: SyncMeta) => {
    metaRef.current = meta
    try {
      window.localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify(meta))
    } catch {
      // Blocked storage. The account copy is still read on the next visit.
    }
  }, [])

  const markSynced = useCallback(
    (base: { id: string; updatedAt: number }, dirty: boolean) => {
      const owner = walletRef.current
      if (!owner) return
      versionRef.current = base.updatedAt
      writeMeta({ owner, savedAt: base.updatedAt, dirty, shareId: base.id })
      setShareId(base.id)
    },
    [writeMeta]
  )

  const readSaved = useCallback((raw: any): SavedBase | null => {
    if (!raw || !isBaseId(raw.id) || typeof raw.updatedAt !== 'number') return null
    return {
      id: raw.id,
      updatedAt: raw.updatedAt,
      layout: sanitizeLayout(raw.layout, inputRef.current.spanFor),
    }
  }, [])

  const adopt = useCallback(
    (remote: SavedBase) => {
      adoptedRef.current = remote.layout
      syncedRef.current = remote.layout
      inputRef.current.replace(remote.layout)
      markSynced(remote, false)
      setStatus('saved')
    },
    [markSynced, setStatus]
  )

  // Declared before `push`, which schedules it, and calls back into it.
  const retryRef = useRef<() => void>(() => {})
  const scheduleRetry = useCallback(() => {
    if (retryTimer.current) clearTimeout(retryTimer.current)
    const wait = Math.min(RETRY_MAX_MS, RETRY_MS * 2 ** failures.current)
    failures.current += 1
    retryTimer.current = setTimeout(() => retryRef.current(), wait)
  }, [])

  const pushOnce = useCallback(
    async (options: { force?: boolean; keepalive?: boolean }): Promise<string | null> => {
      const owner = walletRef.current
      if (!owner || reconciledRef.current !== owner) return null
      const sending = layoutRef.current
      if (!options.force && sending === syncedRef.current) {
        // Undo walked back to what the account already holds.
        const meta = readMeta()
        if (meta?.dirty) writeMeta({ ...meta, dirty: false })
        setStatus('saved')
        return meta && isBaseId(meta.shareId) ? meta.shareId : null
      }
      setStatus('saving')
      const reply = await request(
        inputRef.current.getToken,
        'PUT',
        owner,
        { layout: sending, expected: versionRef.current, force: options.force === true },
        options.keepalive
      )
      if (walletRef.current !== owner) return null

      if (reply.status === 200 && isBaseId(reply.body?.id)) {
        failures.current = 0
        syncedRef.current = sending
        const edited = layoutRef.current !== sending
        markSynced({ id: reply.body.id, updatedAt: Number(reply.body.updatedAt) }, edited)
        // An edit made during the save has its own timer running.
        setStatus(edited ? 'saving' : 'saved')
        return reply.body.id
      }
      if (reply.status === 409) {
        const remote = readSaved(reply.body?.base)
        if (remote) {
          failures.current = 0
          versionRef.current = remote.updatedAt
          if (sameLayout(layoutRef.current, remote.layout)) {
            syncedRef.current = layoutRef.current
            markSynced(remote, false)
            setStatus('saved')
            return remote.id
          }
          setConflict(remote)
          setStatus('conflict')
          return null
        }
      }
      setStatus('error')
      scheduleRetry()
      return null
    },
    [markSynced, readMeta, readSaved, scheduleRetry, setStatus, writeMeta]
  )

  /** One save at a time, so each is sent against the version the last one left. */
  const push = useCallback(
    (options: { force?: boolean; keepalive?: boolean } = {}): Promise<string | null> => {
      const run = queue.current.then(() => pushOnce(options))
      queue.current = run.catch(() => null)
      return run
    },
    [pushOnce]
  )

  retryRef.current = () => {
    const owner = walletRef.current
    if (!owner || statusRef.current !== 'error') return
    if (reconciledRef.current === owner) void push()
    else setAttempt((n) => n + 1)
  }

  // A wallet has appeared, changed or gone: compare its account copy with this browser's.
  useEffect(() => {
    if (!loaded || !identityReady) return
    if (retryTimer.current) clearTimeout(retryTimer.current)
    reconciledRef.current = null
    syncedRef.current = null
    versionRef.current = null
    setConflict(null)
    setShareId(null)
    if (!wallet) {
      setStatus('local')
      return
    }
    let cancelled = false
    setStatus('checking')
    void (async () => {
      const reply = await request(inputRef.current.getToken, 'GET', wallet)
      if (cancelled) return
      if (reply.status !== 200) {
        if (reply.status === 501) {
          setStatus('unavailable')
        } else {
          setStatus('error')
          scheduleRetry()
        }
        return
      }
      failures.current = 0
      const remote = readSaved(reply.body?.base)
      versionRef.current = remote?.updatedAt ?? null
      const local = layoutRef.current
      const decision = reconcile({ address: wallet, local, meta: readMeta(), remote })
      reconciledRef.current = wallet
      if (remote && decision === 'adopt') {
        adopt(remote)
      } else if (remote && decision === 'conflict') {
        setConflict(remote)
        setStatus('conflict')
      } else if (decision === 'push') {
        void push()
      } else {
        if (remote) {
          syncedRef.current = local
          markSynced(remote, false)
        }
        setStatus('saved')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    loaded,
    identityReady,
    wallet,
    attempt,
    adopt,
    markSynced,
    push,
    readMeta,
    readSaved,
    scheduleRetry,
    setStatus,
  ])

  // An edit: note it, and save it once the visitor pauses.
  useEffect(() => {
    if (!loaded) return
    const previous = previousRef.current
    previousRef.current = layout
    // The first layout is the one read from storage.
    if (previous === null || previous === layout) return
    if (layout === adoptedRef.current) {
      adoptedRef.current = null
      return
    }
    const meta = readMeta()
    if (meta && !meta.dirty) writeMeta({ ...meta, dirty: true })
    const owner = walletRef.current
    if (!owner || reconciledRef.current !== owner || statusRef.current === 'conflict') return
    setStatus('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveTimer.current = undefined
      void push()
    }, SAVE_DELAY_MS)
  }, [layout, loaded, push, readMeta, setStatus, writeMeta])

  // Leaving within the quiet time must not lose the last edit.
  useEffect(() => {
    const flush = () => {
      if (!saveTimer.current) return
      clearTimeout(saveTimer.current)
      saveTimer.current = undefined
      void push({ keepalive: true })
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibility)
      flush()
      if (retryTimer.current) clearTimeout(retryTimer.current)
    }
  }, [push])

  // Coming back to the tab: pick up a base changed on another device, or try a failed save again.
  useEffect(() => {
    let last = 0
    const onReturn = () => {
      const owner = walletRef.current
      if (!owner) return
      if (statusRef.current === 'error') {
        retryRef.current()
        return
      }
      if (statusRef.current !== 'saved' || reconciledRef.current !== owner) return
      const now = Date.now()
      if (now - last < REFOCUS_MIN_MS) return
      last = now
      void (async () => {
        const reply = await request(inputRef.current.getToken, 'GET', owner)
        // An edit made while this was in flight wins. Its save will meet the newer copy.
        if (walletRef.current !== owner || statusRef.current !== 'saved') return
        if (reply.status !== 200) return
        const remote = readSaved(reply.body?.base)
        if (!remote || remote.updatedAt === versionRef.current) return
        if (sameLayout(layoutRef.current, remote.layout)) {
          syncedRef.current = layoutRef.current
          markSynced(remote, false)
        } else {
          adopt(remote)
        }
      })()
    }
    window.addEventListener('focus', onReturn)
    window.addEventListener('online', onReturn)
    return () => {
      window.removeEventListener('focus', onReturn)
      window.removeEventListener('online', onReturn)
    }
  }, [adopt, markSynced, readSaved])

  /** Saves anything outstanding now. Resolves to the share id, or null when there is none. */
  const saveNow = useCallback(async (): Promise<string | null> => {
    const owner = walletRef.current
    if (!owner || reconciledRef.current !== owner || statusRef.current === 'conflict') return null
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = undefined
    }
    return push()
  }, [push])

  const retry = useCallback(() => retryRef.current(), [])

  /** Settles a conflict in favour of what is on screen. */
  const keepMine = useCallback(() => {
    if (!conflictRef.current) return
    setConflict(null)
    void push({ force: true })
  }, [push])

  /** Settles a conflict in favour of the account copy. */
  const loadSaved = useCallback(() => {
    const remote = conflictRef.current
    if (!remote) return
    setConflict(null)
    adopt(remote)
  }, [adopt])

  return { status, shareId, saveNow, retry, keepMine, loadSaved }
}
