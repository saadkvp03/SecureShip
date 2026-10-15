import type { ReactNode } from 'react'
import { ExternalLink, Info, LayoutDashboard, Menu, Moon, Plus, Boxes, Sun } from 'lucide-react'
import { useApp } from '../app-context'
import { useHealth } from '../lib/hooks'
import type { Route } from '../lib/router'

function BrandMark() {
  return (
    <svg viewBox="0 0 32 32" className="h-9 w-9" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="rgb(var(--accent))" />
      <path
        d="M8 11.5 16 7l8 4.5v9L16 25l-8-4.5z"
        fill="none"
        stroke="rgb(var(--on-accent))"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="m12.5 16 2.6 2.6 4.6-5"
        fill="none"
        stroke="rgb(var(--on-accent))"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const NAV = [
  { href: '#/', label: 'Tableau de bord', icon: LayoutDashboard, match: ['dashboard'] },
  { href: '#/shipments', label: 'Expéditions', icon: Boxes, match: ['shipments', 'detail'] },
]

function Sidebar({ route, open }: { route: Route; open: boolean }) {
  const online = useHealth()

  return (
    <aside
      id="sidebar"
      className={`sidebar fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-side px-4 py-5 text-[rgb(200_213_235)] transition-[transform,visibility] duration-200 lg:visible lg:translate-x-0 ${
        open ? 'visible translate-x-0' : 'invisible -translate-x-full'
      }`}
    >
      <a href="#/" className="flex items-center gap-3 rounded-lg px-2 py-1.5">
        <BrandMark />
        <span className="text-lg font-extrabold tracking-tight text-white">SecureShip</span>
      </a>

      <nav className="mt-8 flex-1" aria-label="Navigation principale">
        <ul className="space-y-1">
          {NAV.map(({ href, label, icon: Icon, match }) => {
            const active = match.includes(route.name)

            return (
              <li key={href}>
                <a
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                    active ? 'bg-white/10 text-white' : 'hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {active && (
                    <span className="absolute -left-4 top-2 bottom-2 w-1 rounded-r-full bg-accent" />
                  )}
                  <Icon className={`h-5 w-5 ${active ? 'text-accent' : ''}`} aria-hidden="true" />
                  {label}
                </a>
              </li>
            )
          })}
          <li>
            <a
              href="/docs"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-white/5 hover:text-white"
            >
              <ExternalLink className="h-5 w-5" aria-hidden="true" />
              Documentation API
            </a>
          </li>
        </ul>
      </nav>

      <div className="space-y-3">
        <div className="flex items-center gap-2 px-3 text-xs font-semibold">
          <span
            className={`h-2 w-2 rounded-full ${
              online === null ? 'bg-slate-500' : online ? 'bg-accent' : 'bg-red-400'
            }`}
            aria-hidden="true"
          />
          {online === null ? 'Vérification de l’API…' : online ? 'API en ligne' : 'API injoignable'}
        </div>
        <div className="rounded-xl bg-white/5 p-3.5 text-xs leading-relaxed">
          <p className="mb-1 flex items-center gap-1.5 font-bold text-white">
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
            Démonstration locale
          </p>
          Données fictives, sans authentification. Ne pas exposer cette application sur Internet.
        </div>
      </div>
    </aside>
  )
}

export function Layout({
  route,
  title,
  navOpen,
  setNavOpen,
  children,
}: {
  route: Route
  title: string
  navOpen: boolean
  setNavOpen: (open: boolean) => void
  children: ReactNode
}) {
  const { openCreate, theme, toggleTheme } = useApp()

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        onClick={(event) => {
          event.preventDefault()
          document.getElementById('main')?.focus()
        }}
        className="sr-only z-[70] rounded-lg bg-card px-4 py-2 font-semibold shadow-pop focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Aller au contenu
      </a>

      <Sidebar route={route} open={navOpen} />

      {navOpen && (
        <div
          className="fixed inset-0 z-30 bg-side/60 lg:hidden"
          onClick={() => setNavOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-bg/85 px-4 backdrop-blur sm:px-8">
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-lg text-ink hover:bg-raised lg:hidden"
            onClick={() => setNavOpen(!navOpen)}
            aria-label="Ouvrir le menu"
            aria-expanded={navOpen}
            aria-controls="sidebar"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>

          <h1 className="flex-1 truncate text-lg font-extrabold tracking-tight">{title}</h1>

          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-lg text-muted transition-colors hover:bg-raised hover:text-ink"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre'}
          >
            {theme === 'dark' ? (
              <Sun className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Moon className="h-5 w-5" aria-hidden="true" />
            )}
          </button>

          <button type="button" className="btn-primary" onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Nouvelle expédition</span>
            <span className="sm:hidden">Nouvelle</span>
          </button>
        </header>

        <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-6 outline-none sm:px-8 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  )
}
