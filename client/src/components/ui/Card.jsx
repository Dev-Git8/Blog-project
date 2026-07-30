export function Card({ as: Component = 'div', className = '', ...props }) {
  return (
    <Component
      className={`rounded-2xl border-2 border-ink bg-card shadow-[var(--shadow-hard)] ${className}`}
      {...props}
    />
  )
}
