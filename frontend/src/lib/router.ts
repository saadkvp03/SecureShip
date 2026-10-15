import { useEffect, useMemo, useState } from 'react'

// Hash-based routing (#/shipments/12): no server-side route handling needed.
export type Route =
  | { name: 'dashboard' }
  | { name: 'shipments'; query: URLSearchParams }
  | { name: 'detail'; id: number }
  | { name: 'notfound' }

function parse(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/'
  const [path, search = ''] = raw.split('?')
  const parts = path.split('/').filter(Boolean)

  if (parts.length === 0) return { name: 'dashboard' }

  if (parts[0] === 'shipments') {
    if (parts.length === 1) {
      return { name: 'shipments', query: new URLSearchParams(search) }
    }

    const id = Number(parts[1])

    if (parts.length === 2 && Number.isInteger(id) && id > 0) {
      return { name: 'detail', id }
    }
  }

  return { name: 'notfound' }
}

export function useRoute(): Route {
  const [hash, setHash] = useState(window.location.hash)

  useEffect(() => {
    const onChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  return useMemo(() => parse(hash), [hash])
}

export function navigate(path: string): void {
  window.location.hash = path
}
