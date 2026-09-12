import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '../auth'
import { BUSINESS, HORAS_RAPIDAS, STATUS_LABELS } from '../config'
import {
  createReservation,
  fetchStaffDirectory,
  listReservations,
  updateReservation,
  updateReservationStatus,
} from '../lib/api'
import type { Reservation, ReservationStatus, StaffUser } from '../types'

function todayISO() {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

function formatFecha(iso: string) {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}`
}

function nearestHour() {
  const now = new Date()
  const h = now.getHours()
  const m = now.getMinutes()
  const candidate =
    m < 15
      ? `${String(h).padStart(2, '0')}:00`
      : m < 45
        ? `${String(h).padStart(2, '0')}:30`
        : `${String(Math.min(h + 1, 23)).padStart(2, '0')}:00`
  return HORAS_RAPIDAS.includes(candidate) ? candidate : '14:00'
}

export function StaffPage() {
  const { user, loading, login } = useAuth()
  const [directory, setDirectory] = useState<StaffUser[]>([])
  const [staffId, setStaffId] = useState('lorena')
  const [pin, setPin] = useState('')
  const [items, setItems] = useState<Reservation[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingCodigo, setEditingCodigo] = useState<string | null>(null)
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [fecha, setFecha] = useState(todayISO())
  const [hora, setHora] = useState(nearestHour())
  const [personas, setPersonas] = useState(2)
  const [notas, setNotas] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [soloHoy, setSoloHoy] = useState(true)

  useEffect(() => {
    void fetchStaffDirectory().then((list) => {
      setDirectory(list)
      if (list[0]) setStaffId(list[0].id)
    })
  }, [])

  async function refresh() {
    setItems(await listReservations())
  }

  useEffect(() => {
    if (!user) return
    void refresh().catch((err: unknown) =>
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las reservas'),
    )
    const t = window.setInterval(() => {
      void refresh().catch(() => undefined)
    }, 4000)
    return () => window.clearInterval(t)
  }, [user])

  const lista = useMemo(() => {
    const hoy = todayISO()
    return items
      .filter((r) => (soloHoy ? r.fecha === hoy : true))
      .filter((r) => r.estado !== 'cancelada')
      .sort((a, b) => `${a.fecha}${a.hora}`.localeCompare(`${b.fecha}${b.hora}`))
  }, [items, soloHoy])

  function resetForm() {
    setEditingId(null)
    setEditingCodigo(null)
    setNombre('')
    setTelefono('')
    setNotas('')
    setPersonas(2)
    setHora(nearestHour())
    setFecha(todayISO())
  }

  function startEdit(r: Reservation) {
    setEditingId(r.id)
    setEditingCodigo(r.codigo)
    setNombre(r.nombre)
    setTelefono(r.telefono)
    setFecha(r.fecha)
    setHora(r.hora)
    setPersonas(r.personas)
    setNotas(r.notas)
    setError(null)
    setFlash(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function onLogin(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await login(staffId, pin)
      setPin('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo entrar')
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!nombre.trim()) {
      setError('Pon el nombre del cliente.')
      return
    }
    setSubmitting(true)
    try {
      if (editingId) {
        const r = await updateReservation(editingId, {
          nombre: nombre.trim(),
          telefono: telefono.trim(),
          fecha,
          hora,
          personas,
          notas: notas.trim(),
        })
        setFlash(`✓ Actualizada · ${r.codigo} · ${r.nombre} · ${r.personas}p · ${r.hora}`)
      } else {
        const r = await createReservation({
          nombre: nombre.trim(),
          telefono: telefono.trim(),
          fecha,
          hora,
          personas,
          notas: notas.trim(),
          creadoPor: user?.name ?? 'personal',
        })
        setFlash(`✓ Guardada · ${r.codigo} · ${r.nombre} · ${r.personas}p · ${r.hora}`)
      }
      resetForm()
      await refresh()
      window.setTimeout(() => setFlash(null), 3500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSubmitting(false)
    }
  }

  async function setEstado(id: string, estado: ReservationStatus) {
    await updateReservationStatus(id, { estado })
    if (editingId === id) resetForm()
    await refresh()
  }

  if (loading) {
    return (
      <main className="page">
        <div className="card center">Cargando…</div>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="page">
        <div className="card login-box">
          <img src="/logo.jpg" alt="Casa Torino" />
          <h1>Reservas Casa Torino</h1>
          <p className="muted">Elige tu nombre y escribe el PIN</p>
          {error && <div className="alert alert-error">{error}</div>}
          <form className="quick-form" onSubmit={(e) => void onLogin(e)}>
            <label>
              Quién eres
              <select value={staffId} onChange={(e) => setStaffId(e.target.value)}>
                {directory.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              PIN
              <input
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="1234"
                autoComplete="current-password"
                required
              />
            </label>
            <button className="btn btn-gold btn-lg" type="submit">
              Entrar
            </button>
          </form>
          <p className="muted small" style={{ marginTop: '0.75rem' }}>
            PIN de las 4: <b>1234</b>
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="page">
      <section className="card">
        <div className="section-head">
          <div>
            <h1>{editingId ? 'Editar reserva' : 'Nueva reserva'}</h1>
            <p className="muted">
              Hola, {user.name}
              {editingCodigo ? ` · ${editingCodigo}` : ''}
            </p>
          </div>
          {editingId && (
            <button className="btn btn-ghost" type="button" onClick={resetForm}>
              Cancelar
            </button>
          )}
        </div>

        {flash && <div className="alert alert-ok">{flash}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        <form className="quick-form" onSubmit={(e) => void onSubmit(e)}>
          <label>
            Nombre *
            <input
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre del cliente"
              autoComplete="off"
              required
            />
          </label>

          <label>
            Teléfono
            <input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="Opcional"
              inputMode="tel"
              autoComplete="off"
            />
          </label>

          <div>
            <span className="field-label">Personas</span>
            <div className="chip-row">
              {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`chip ${personas === n ? 'chip-on' : ''}`}
                  onClick={() => setPersonas(n)}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                className={`chip ${personas > 8 ? 'chip-on' : ''}`}
                onClick={() => setPersonas(Math.min(BUSINESS.maxPartySize, Math.max(9, personas)))}
              >
                9+
              </button>
            </div>
          </div>

          <div className="two-cols">
            <label>
              Día
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
            </label>
            <label>
              Hora
              <select value={hora} onChange={(e) => setHora(e.target.value)} required>
                {HORAS_RAPIDAS.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label>
            Nota
            <input
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Opcional"
              maxLength={120}
            />
          </label>

          <button className="btn btn-gold btn-lg" type="submit" disabled={submitting}>
            {submitting ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Guardar'}
          </button>
        </form>
      </section>

      <section className="card">
        <div className="section-head">
          <h2>{soloHoy ? 'Hoy' : 'Todas'}</h2>
          <button className="btn btn-ghost" type="button" onClick={() => setSoloHoy((v) => !v)}>
            {soloHoy ? 'Ver todas' : 'Solo hoy'}
          </button>
        </div>

        {lista.length === 0 && <p className="muted">No hay reservas{soloHoy ? ' para hoy' : ''}.</p>}

        <ul className="res-list">
          {lista.map((r) => (
            <li key={r.id} className={`res-item ${editingId === r.id ? 'res-item-editing' : ''}`}>
              <div>
                <div className="res-title">
                  <b>
                    {formatFecha(r.fecha)} · {r.hora}
                  </b>{' '}
                  · {r.nombre} · {r.personas}p
                </div>
                <div className="muted small">
                  {r.codigo}
                  {r.telefono ? ` · ${r.telefono}` : ''}
                  {r.notas ? ` · ${r.notas}` : ''}
                  {r.creadoPor ? ` · por ${r.creadoPor}` : ''}
                  {' · '}
                  <span className={`badge badge-${r.estado}`}>{STATUS_LABELS[r.estado]}</span>
                </div>
              </div>
              <div className="row-actions">
                {r.estado === 'confirmada' && (
                  <>
                    <button className="btn btn-outline" type="button" onClick={() => startEdit(r)}>
                      Editar
                    </button>
                    <button className="btn btn-ok" type="button" onClick={() => void setEstado(r.id, 'completada')}>
                      Hecha
                    </button>
                    <button className="btn btn-ghost" type="button" onClick={() => void setEstado(r.id, 'no_show')}>
                      No vino
                    </button>
                    <button className="btn btn-danger" type="button" onClick={() => void setEstado(r.id, 'cancelada')}>
                      Anular
                    </button>
                  </>
                )}
                {r.telefono && (
                  <a
                    className="btn btn-outline"
                    href={`https://wa.me/34${r.telefono.replace(/\D/g, '').replace(/^34/, '')}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    WA
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <p className="footer-mini">
        {BUSINESS.name} · Online · {BUSINESS.address}
      </p>
    </main>
  )
}
