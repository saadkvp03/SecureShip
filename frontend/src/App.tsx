import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppContext, type Theme, type ToastKind } from './app-context'
import { CreateShipmentDialog } from './components/CreateShipmentDialog'
import { Layout } from './components/Layout'
import { Toasts, type ToastItem } from './components/Toasts'
import { EmptyState } from './components/ui'
import { useRoute } from './lib/router'
import Dashboard from './pages/Dashboard'
import Detail from './pages/Detail'
import Shipments from './pages/Shipments'

const TITLES = {
  dashboard: 'Tableau de bord',
  shipments: 'Expéditions',
  detail: 'Détails de l’expédition',
  notfound: 'Page introuvable',
} as const

export default function App() {
  const route = useRoute()
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  )
  const [version, setVersion] = useState(0)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const notify = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId.current++
      setToasts((current) => [...current.slice(-3), { id, kind, message }])
      window.setTimeout(() => dismiss(id), kind === 'error' ? 8000 : 4500)
    },
    [dismiss],
  )

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === 'dark' ? 'light' : 'dark'
      document.documentElement.classList.toggle('dark', next === 'dark')

      try {
        localStorage.setItem('secureship-theme', next)
      } catch {
        // Storage can be blocked (private mode); the theme still applies.
      }

      return next
    })
  }, [])

  const context = useMemo(
    () => ({
      notify,
      version,
      bump: () => setVersion((value) => value + 1),
      openCreate: () => setCreateOpen(true),
      theme,
      toggleTheme,
    }),
    [notify, version, theme, toggleTheme],
  )

  // On every navigation: back to top, close the mobile menu, move focus.
  const routeKey = route.name === 'detail' ? `detail-${route.id}` : route.name
  useEffect(() => {
    window.scrollTo(0, 0)
    setNavOpen(false)
    document.getElementById('main')?.focus({ preventScroll: true })
  }, [routeKey])

  useEffect(() => {
    document.title = `${TITLES[route.name]} · SecureShip`
  }, [route.name])

  useEffect(() => {
    if (!navOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNavOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navOpen])

  return (
    <AppContext.Provider value={context}>
      <Layout route={route} title={TITLES[route.name]} navOpen={navOpen} setNavOpen={setNavOpen}>
        {route.name === 'dashboard' && <Dashboard />}
        {route.name === 'shipments' && <Shipments route={route} />}
        {route.name === 'detail' && <Detail id={route.id} />}
        {route.name === 'notfound' && (
          <EmptyState
            title="Cette page n’existe pas"
            message="Le lien est peut-être incorrect. Retournez au tableau de bord ou à la liste des expéditions."
            action={
              <a href="#/" className="btn-primary">
                Retour au tableau de bord
              </a>
            }
          />
        )}
      </Layout>

      <CreateShipmentDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(reference) => {
          setCreateOpen(false)
          setVersion((value) => value + 1)
          notify('success', `Expédition ${reference} créée.`)
        }}
        onError={(message) => notify('error', message)}
      />

      <Toasts items={toasts} onDismiss={dismiss} />
    </AppContext.Provider>
  )
}
