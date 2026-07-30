const TONES = {
  mustard: 'bg-mustard text-ink',
  ink: 'bg-ink text-parchment',
}

export function Badge({ tone = 'mustard', className = '', ...props }) {
  return (
    <span
      className={`inline-block rounded-full border-2 border-ink px-3 py-0.5 text-xs font-semibold tracking-wide ${TONES[tone]} ${className}`}
      {...props}
    />
  )
}
