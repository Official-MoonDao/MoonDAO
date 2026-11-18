import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { emptyLayout, sanitizeLayout, type ItemKind, type MoonbaseLayout } from './grid'

export const LAYOUT_STORAGE_KEY = 'my-moonbase:layout:v1'
const HISTORY_LIMIT = 80

type History = {
  past: MoonbaseLayout[]
  present: MoonbaseLayout
  future: MoonbaseLayout[]
  /** Group of the last edit. Consecutive edits in one group share an undo step. */
  group: string | null
}

type Action =
  | { type: 'load'; layout: MoonbaseLayout }
  | { type: 'edit'; edit: (layout: MoonbaseLayout) => MoonbaseLayout; group?: string }
  | { type: 'undo' }
  | { type: 'redo' }

function reducer(state: History, action: Action): History {
  switch (action.type) {
    case 'load':
      return { past: [], present: action.layout, future: [], group: null }
    case 'edit': {
      const next = action.edit(state.present)
      if (next === state.present) return state
      const group = action.group ?? null
      // Typing a name is one undo step, not one per keystroke.
      const merge = group !== null && group === state.group
      return {
        past: merge ? state.past : [...state.past, state.present].slice(-HISTORY_LIMIT),
        present: next,
        future: [],
        group,
      }
    }
    case 'undo': {
      const previous = state.past[state.past.length - 1]
      if (!previous) return state
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
        group: null,
      }
    }
    case 'redo': {
      const [next, ...rest] = state.future
      if (!next) return state
      return { past: [...state.past, state.present], present: next, future: rest, group: null }
    }
  }
}

/**
 * The visitor's base, kept in this browser. `spanFor` is the current catalogue
 * footprint for an item, or undefined when the item no longer exists.
 */
export function useMoonbaseLayout(
  spanFor: (kind: ItemKind, ref: string) => number | undefined
) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    past: [],
    present: emptyLayout(),
    future: [],
    group: null,
  }))
  // Storage is read after mount so the server markup and the first client
  // render agree. Nothing is written until that read has happened, or an
  // empty plot would overwrite the saved one.
  const [loaded, setLoaded] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const spanForRef = useRef(spanFor)
  spanForRef.current = spanFor

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LAYOUT_STORAGE_KEY)
      if (raw) {
        dispatch({ type: 'load', layout: sanitizeLayout(JSON.parse(raw), spanForRef.current) })
      }
    } catch {
      // Unreadable or blocked storage starts an empty plot.
    }
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!loaded) return
    try {
      window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(state.present))
      setSaveFailed(false)
    } catch {
      setSaveFailed(true)
    }
  }, [loaded, state.present])

  const edit = useCallback(
    (change: (layout: MoonbaseLayout) => MoonbaseLayout, group?: string) =>
      dispatch({ type: 'edit', edit: change, group }),
    []
  )
  const undo = useCallback(() => dispatch({ type: 'undo' }), [])
  const redo = useCallback(() => dispatch({ type: 'redo' }), [])

  return {
    layout: state.present,
    loaded,
    saveFailed,
    edit,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  }
}
