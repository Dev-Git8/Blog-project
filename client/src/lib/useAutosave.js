import { useCallback, useEffect, useRef, useState } from 'react'

const RETRY_AFTER_MS = 5000

// Silent data loss is treated as a defect, so this hook tracks three things
// separately: what the user has typed, what the server has acknowledged, and
// whether a save is currently in flight.
export function useAutosave({ value, onSave, delay = 1500, enabled = true }) {
  const [status, setStatus] = useState('idle')
  const [lastError, setLastError] = useState(null)
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(value))

  const latest = useRef(value)
  const acknowledged = useRef(JSON.stringify(value))
  const debounceTimer = useRef(null)
  const retryTimer = useRef(null)
  const inFlight = useRef(false)

  latest.current = value

  const flush = useCallback(async () => {
    const snapshot = JSON.stringify(latest.current)
    if (snapshot === acknowledged.current || inFlight.current) return

    inFlight.current = true
    setStatus('saving')
    try {
      await onSave(latest.current)
      acknowledged.current = snapshot
      setSavedSnapshot(snapshot)
      setStatus('saved')
      setLastError(null)
    } catch (error) {
      setStatus('error')
      setLastError(error)
      // One automatic retry; the visible Retry control covers everything after.
      clearTimeout(retryTimer.current)
      retryTimer.current = setTimeout(() => {
        flush()
      }, RETRY_AFTER_MS)
    } finally {
      inFlight.current = false
    }
  }, [onSave])

  useEffect(() => {
    if (!enabled) return undefined
    if (JSON.stringify(value) === acknowledged.current) return undefined

    clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(flush, delay)
    return () => clearTimeout(debounceTimer.current)
  }, [value, delay, enabled, flush])

  useEffect(
    () => () => {
      clearTimeout(debounceTimer.current)
      clearTimeout(retryTimer.current)
    },
    [],
  )

  const dirty = JSON.stringify(value) !== savedSnapshot

  useEffect(() => {
    if (!dirty) return undefined
    const warn = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  return { status, lastError, dirty, saveNow: flush }
}
