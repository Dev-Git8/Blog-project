// The circular rotating-text seal from the reference. Decorative ring, real
// button in the middle — so it is still operable by keyboard and screen reader.
export function RotatingBadge({ text, label, onClick, className = '' }) {
  const repeated = `${text} · `.repeat(2)

  return (
    <div className={`relative size-36 ${className}`}>
      <svg
        viewBox="0 0 200 200"
        className="size-full animate-[spin_18s_linear_infinite]"
        aria-hidden="true"
      >
        <defs>
          <path
            id="rotating-badge-path"
            d="M100,100 m-74,0 a74,74 0 1,1 148,0 a74,74 0 1,1 -148,0"
          />
        </defs>
        <text fontSize="15" letterSpacing="1.5" fill="currentColor" fontWeight="600">
          <textPath href="#rotating-badge-path">{repeated}</textPath>
        </text>
      </svg>
      <button
        type="button"
        onClick={onClick}
        className="absolute inset-8 rounded-full border-2 border-ink bg-ink text-xs font-bold uppercase leading-tight text-parchment focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        {label}
      </button>
    </div>
  )
}
