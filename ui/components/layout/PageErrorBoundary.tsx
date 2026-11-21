import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

/**
 * React unmounts the whole tree when an error escapes rendering or an effect
 * cleanup. Without a boundary the site goes blank and the console only shows
 * minified React frames. This keeps the layout up, offers a retry, and logs the
 * component stack so the failing component can be named.
 */
export default class PageErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[PageErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="mx-auto my-16 max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
        <p className="text-lg font-semibold text-white">Something went wrong on this page.</p>
        <p className="mt-2 text-sm text-gray-300">
          Try again. If it keeps happening, reload the page.
        </p>
        <button
          type="button"
          onClick={() => this.setState({ error: null })}
          className="mt-4 rounded-full bg-white px-5 py-2 text-sm font-semibold text-black hover:bg-gray-200"
        >
          Try again
        </button>
      </div>
    )
  }
}
