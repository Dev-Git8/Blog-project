import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const show = useCallback((message, tone = 'ink') => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts((current) => [...current, { id, message, tone }])
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
    }, 5000)
  }, [])

  const value = useMemo(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((toast) => (
          <p
            key={toast.id}
            className={[
              'pointer-events-auto max-w-md rounded-xl border-2 border-ink px-4 py-2.5 text-sm font-medium shadow-[var(--shadow-hard-sm)]',
              toast.tone === 'error' ? 'bg-brick text-white' : 'bg-card text-ink',
            ].join(' ')}
          >
            {toast.message}
          </p>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  // A missing provider would silently swallow every error message, so fail loudly.
  if (!context) throw new Error('useToast must be used inside a ToastProvider')
  return context
}
