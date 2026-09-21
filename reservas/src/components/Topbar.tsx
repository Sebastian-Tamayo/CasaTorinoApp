import { useAuth } from '../auth'
import { BUSINESS, GESTION_INTERNA_URL } from '../config'

export function Topbar() {
  const { user, logout } = useAuth()

  return (
    <header className="topbar">
      <div className="topbar-left">
        <a
          className="btn-leave"
          href={GESTION_INTERNA_URL}
          aria-label="Salir a gestión interna"
          title="Gestión interna"
        >
          ←
        </a>
        <div className="brand">
          <img src="/logo.jpg" alt="Casa Torino" />
          <div>
            <strong>{BUSINESS.name}</strong>
            <span>Reservas online · 4 personas</span>
          </div>
        </div>
      </div>
      {user && (
        <button className="btn btn-ghost" type="button" onClick={logout}>
          Salir
        </button>
      )}
    </header>
  )
}
