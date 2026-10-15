import { useEffect, useState } from 'react'
import { ApiError } from './api'

interface AsyncState<T> {
  data: T | null
  error: ApiError | null
  loading: boolean
}

// Loads data, cancels outdated requests and keeps the previous data
// on screen while a refresh is running (no flicker).
export function useAsync<T>(
  load: (signal: AbortSignal) => Promise<T>,
  deps: ReadonlyArray<unknown>,
) {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    error: null,
    loading: true,
  })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    setState((current) => ({ ...current, loading: true, error: null }))

    load(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setState({ data, error: null, loading: false })
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setState({
          data: null,
          error:
            error instanceof ApiError
              ? error
              : new ApiError('Une erreur inattendue est survenue.'),
          loading: false,
        })
      })

    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt])

  return { ...state, reload: () => setAttempt((value) => value + 1) }
}

export function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])

  return debounced
}

// Real API availability, polled from GET /health.
export function useHealth(): boolean | null {
  const [online, setOnline] = useState<boolean | null>(null)

  useEffect(() => {
    let alive = true

    const check = async () => {
      try {
        const response = await fetch('/health')
        if (alive) setOnline(response.ok)
      } catch {
        if (alive) setOnline(false)
      }
    }

    void check()
    const timer = window.setInterval(check, 30000)

    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [])

  return online
}
