const VARIANTS = {
  primary: 'bg-mustard text-ink hover:bg-[#f0c445]',
  ink: 'bg-ink text-parchment hover:bg-[#241f19]',
  ghost: 'bg-transparent text-ink hover:bg-card',
  danger: 'bg-brick text-white hover:bg-[#c9522f]',
}

const SIZES = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-5 py-2.5 text-base',
  lg: 'px-7 py-3.5 text-lg',
}

export function Button({
  as: Component = 'button',
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}) {
  return (
    <Component
      className={[
        'inline-flex items-center justify-center gap-2 rounded-full border-2 border-ink font-semibold',
        'shadow-[var(--shadow-hard-sm)] transition-transform',
        // The press moves the element onto its own shadow — a physical-feeling
        // interaction that costs one line of CSS.
        'hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      ].join(' ')}
      {...props}
    />
  )
}
