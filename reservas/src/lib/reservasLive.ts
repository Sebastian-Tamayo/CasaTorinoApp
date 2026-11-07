/**
 * Realtime staff: postgres_changes en ops_kv key=reservas (0 Vercel).
 * Poll de respaldo en StaffPage se alarga cuando el canal está sano.
 */
import type { Reservation } from '../types'

const SB_URL = 'https://fpnjtgoxljqmwuukyrrm.supabase.co'
const SB_ANON = 'sb_publishable_A_zxEJjB3NN_hh8Qdu7ccQ_qhcWGoz0'
const ITEM_KEY = 'reservas'
const LIVE_CHANNEL = 'casa-torino-reservas-staff'
const SB_CDN =
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/dist/umd/supabase.min.js'

type RemoteReservation = Omit<Reservation, 'id'> & { _id?: string; id?: string }

type SbChannel = {
  on: (...args: unknown[]) => SbChannel
  subscribe: (cb: (status: string) => void) => unknown
}

type SbClient = {
  channel: (name: string, opts?: { config?: { broadcast?: { self?: boolean } } }) => SbChannel
  removeChannel?: (ch: SbChannel) => void
  from: (table: string) => {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => {
        maybeSingle: () => Promise<{ data: { value?: unknown } | null; error: Error | null }>
      }
    }
  }
}

declare global {
  interface Window {
    supabase?: { createClient: (url: string, key: string, opts?: unknown) => SbClient }
    __casaTorinoSbClient?: SbClient
  }
}

function mapReservation(raw: RemoteReservation): Reservation {
  return {
    id: raw.id || raw._id || '',
    codigo: raw.codigo,
    nombre: raw.nombre,
    telefono: raw.telefono || '',
    fecha: raw.fecha,
    hora: raw.hora,
    personas: Number(raw.personas) || 1,
    notas: raw.notas || '',
    estado: raw.estado,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    creadoPor: raw.creadoPor || '',
  }
}

function normalizeItems(value: unknown): Reservation[] {
  const raw = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && Array.isArray((value as { items?: unknown }).items)
      ? ((value as { items: RemoteReservation[] }).items)
      : []
  return raw
    .map((r) => mapReservation(r as RemoteReservation))
    .filter((r) => r.id)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
}

let sbClient: SbClient | null = null
let sbChannel: SbChannel | null = null
let started = false

async function ensureSb(): Promise<SbClient> {
  if (sbClient) return sbClient
  if (!window.supabase?.createClient) {
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script')
      s.src = SB_CDN
      s.async = true
      s.onload = () => resolve()
      s.onerror = () => reject(new Error('supabase-js'))
      document.head.appendChild(s)
    })
  }
  if (window.__casaTorinoSbClient) {
    sbClient = window.__casaTorinoSbClient
    return sbClient
  }
  sbClient = window.supabase!.createClient(SB_URL, SB_ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 4 } },
  })
  window.__casaTorinoSbClient = sbClient
  return sbClient
}

export async function pullReservasFromOpsKv(): Promise<Reservation[]> {
  const c = await ensureSb()
  const { data, error } = await c.from('ops_kv').select('value').eq('key', ITEM_KEY).maybeSingle()
  if (error) throw error
  return normalizeItems(data?.value)
}

export type ReservasLiveHandlers = {
  onItems?: (items: Reservation[]) => void
  onStatus?: (ok: boolean) => void
}

/** Suscribe Realtime; al cambio lee ops_kv (sin Vercel). Devuelve cleanup. */
export function startReservasLive(handlers: ReservasLiveHandlers): () => void {
  if (started) return () => undefined
  started = true
  let cancelled = false

  void (async () => {
    try {
      const c = await ensureSb()
      if (cancelled) return
      sbChannel = c.channel(LIVE_CHANNEL, {
        config: { broadcast: { self: false } },
      })
      const tick = () => {
        void pullReservasFromOpsKv()
          .then((items) => {
            if (!cancelled) handlers.onItems?.(items)
          })
          .catch((err) => console.warn('[reservasLive] pull', err))
      }
      sbChannel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ops_kv',
          filter: `key=eq.${ITEM_KEY}`,
        },
        tick,
      )
      sbChannel.subscribe((status) => {
        if (cancelled) return
        if (status === 'SUBSCRIBED') {
          handlers.onStatus?.(true)
        } else if (
          status === 'CHANNEL_ERROR' ||
          status === 'TIMED_OUT' ||
          status === 'CLOSED'
        ) {
          handlers.onStatus?.(false)
        }
      })
    } catch (err) {
      console.warn('[reservasLive] realtime', err)
      if (!cancelled) handlers.onStatus?.(false)
    }
  })()

  return () => {
    cancelled = true
    started = false
    try {
      const ch = sbChannel
      sbChannel = null
      if (ch && sbClient?.removeChannel) sbClient.removeChannel(ch)
    } catch {
      /* ignore */
    }
    handlers.onStatus?.(false)
  }
}
