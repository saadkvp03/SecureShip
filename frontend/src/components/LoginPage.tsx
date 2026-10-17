import { useState, type FormEvent } from 'react'
import { LockKeyhole, ShieldCheck } from 'lucide-react'
import { login, type AuthInfo } from '../lib/api'

export default function LoginPage({ onLogin }: { onLogin: (session: AuthInfo) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      const session = await login(username, password)
      onLogin(session)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connexion impossible.')
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <div className="card w-full max-w-md p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-accent/15 text-accent-ink">
            <ShieldCheck className="h-7 w-7" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold">SecureShip</h1>
            <p className="text-sm text-muted">Laboratoire local de cybersécurité</p>
          </div>
        </div>
        <h2 className="mb-5 flex items-center gap-2 text-lg font-bold">
          <LockKeyhole className="h-5 w-5" aria-hidden="true" />
          Connexion
        </h2>
        <form onSubmit={(event) => { void submit(event) }} className="space-y-4">
          <label className="block text-sm font-semibold" htmlFor="login-name">
            Identifiant
          </label>
          <input id="login-name" className="input" autoComplete="username"
            maxLength={100} required value={username}
            onChange={(event) => setUsername(event.target.value)} />
          <label className="block text-sm font-semibold" htmlFor="login-password">
            Mot de passe
          </label>
          <input id="login-password" className="input" type="password"
            autoComplete="current-password" maxLength={256} required value={password}
            onChange={(event) => setPassword(event.target.value)} />
          {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={pending}>
            {pending ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
        <p className="mt-6 text-xs leading-relaxed text-muted">
          Accès réservé à l’opérateur du laboratoire. Données fictives uniquement.
        </p>
      </div>
    </main>
  )
}
