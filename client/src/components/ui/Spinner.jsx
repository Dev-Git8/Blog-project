export function Spinner({ label = 'Loading' }) {
  return (
    <span role="status" aria-live="polite" className="inline-flex items-center gap-2 text-sm">
      <span className="size-4 animate-spin rounded-full border-2 border-ink border-t-transparent" />
      {label}
    </span>
  )
}
