import { useAuth } from '../auth'
import { BUSINESS, INTERNO_URL } from '../config'

export function Topbar() {
  const { user, logout } = useAuth()

  return (
    <header className="topbar">
      <div className="brand">
        <img src="/logo.jpg" alt="Casa Torino" />
        <div>
          <strong>{BUSINESS.name}</strong>
          <span>Reservas online · 4 personas</span>
        </div>
      </div>
      <div className="topbar-actions">
        {user && (
          <button className="btn btn-ghost" type="button" onClick={logout}>
            Salir
          </button>
        )}
        <a
          className="btn-leave"
          href={INTERNO_URL}
          aria-label="Salir a gestión interna"
          title="Volver"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </a>
      </div>
    </header>
  )
}
