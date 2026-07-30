export function Input({ id, label, error, className = '', ...props }) {
  const errorId = error ? `${id}-error` : undefined
  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
      ) : null}
      <input
        id={id}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={errorId}
        className={[
          'rounded-xl border-2 border-ink bg-card px-3.5 py-2.5',
          'focus:outline-2 focus:outline-offset-1 focus:outline-ink',
          error ? 'border-brick' : '',
          className,
        ].join(' ')}
        {...props}
      />
      {error ? (
        <p id={errorId} className="text-sm font-medium text-brick">
          {error}
        </p>
      ) : null}
    </div>
  )
}
