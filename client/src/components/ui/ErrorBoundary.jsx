import { Component } from 'react'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[boundary]', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      this.props.fallback ?? (
        <div className="mx-auto max-w-lg p-8 text-center">
          <h1 className="display text-4xl">Something broke</h1>
          <p className="mt-3">
            This page hit an error. Reloading usually fixes it — your saved work is safe.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded-full border-2 border-ink bg-mustard px-5 py-2.5 font-semibold shadow-[var(--shadow-hard-sm)]"
          >
            Reload the page
          </button>
        </div>
      )
    )
  }
}
