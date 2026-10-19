/**
 * Casa Torino TPV — PIN de camarera por jornada (cliente).
 */
(() => {
  const API = '/api/waiter-pin'
  const STORAGE_KEY = 'ct-waiter-pin-unlock-v1'

  let jornadaStartedAt = null
  let unlocked = Object.create(null)
  let modalMode = 'verify' // verify | setup | change
  let modalWaiter = null
  let pinBuf = ''
  let pinBuf2 = ''
  let setupStep = 1
  let resolveFlow = null
  let rejectFlow = null

  function clientHeaders(extra) {
    if (typeof window.__casaTorinoTpvClientHeaders === 'function') {
      return window.__casaTorinoTpvClientHeaders(extra)
    }
    return Object.assign({ 'Cache-Control': 'no-store' }, extra || {})
  }

  function loadUnlockStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const o = JSON.parse(raw)
      if (o && typeof o === 'object') {
        jornadaStartedAt = o.jornadaStartedAt || null
        unlocked = o.unlocked && typeof o.unlocked === 'object' ? o.unlocked : {}
      }
    } catch {
      jornadaStartedAt = null
      unlocked = Object.create(null)
    }
  }

  function saveUnlockStore() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ jornadaStartedAt, unlocked }),
      )
    } catch {}
  }

  function clearUnlockStore() {
    jornadaStartedAt = null
    unlocked = Object.create(null)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {}
  }

  function onJornadaChange(j) {
    const started = j?.status === 'open' ? j.startedAt || null : null
    if (j?.status === 'ended' || j?.status === 'closed') {
      clearUnlockStore()
      return
    }
    if (started && jornadaStartedAt && jornadaStartedAt !== started) {
      unlocked = Object.create(null)
      jornadaStartedAt = started
      saveUnlockStore()
      return
    }
    if (started && !jornadaStartedAt) {
      jornadaStartedAt = started
      saveUnlockStore()
    }
  }

  function isUnlocked(waiterId, startedAt) {
    const id = String(waiterId || '').trim()
    if (!id || !startedAt) return false
    if (jornadaStartedAt !== startedAt) return false
    return Boolean(unlocked[id])
  }

  function markUnlocked(waiterId, startedAt) {
    const id = String(waiterId || '').trim()
    if (!id || !startedAt) return
    jornadaStartedAt = startedAt
    unlocked[id] = true
    saveUnlockStore()
  }

  async function apiGetHasPin(waiterId) {
    const r = await fetch(`${API}?waiterId=${encodeURIComponent(waiterId)}`, {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: clientHeaders(),
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(data.error || 'No se pudo comprobar PIN')
    return Boolean(data.hasPin)
  }

  async function apiPost(body) {
    const r = await fetch(API, {
      method: 'POST',
      credentials: 'same-origin',
      headers: clientHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    })
    const data = await r.json().catch(() => ({}))
    if (r.status === 401 && typeof window.__casaTorinoTpvAuthLost === 'function') {
      window.__casaTorinoTpvAuthLost()
    }
    return { ok: r.ok, status: r.status, data }
  }

  function $(id) {
    return document.getElementById(id)
  }

  function paintDots(elId, len) {
    const box = $(elId)
    if (!box) return
    const dots = box.querySelectorAll('i')
    dots.forEach((d, i) => d.classList.toggle('on', i < len))
  }

  function showModal(mode, waiter, opts) {
    modalMode = mode
    modalWaiter = waiter
    pinBuf = ''
    pinBuf2 = ''
    setupStep = opts?.setupStep || 1
    const gate = $('waiterGate')
    if (!gate) return Promise.reject(new Error('Modal PIN no disponible'))
    const title = $('waiterGateTitle')
    const sub = $('waiterGateSub')
    const name = waiter?.name || 'Camarera'
    if (mode === 'setup') {
      if (title) title.textContent = setupStep === 1 ? 'Crea tu PIN' : 'Repite el PIN'
      if (sub)
        sub.textContent =
          setupStep === 1
            ? `${name}: elige un PIN de 4 dígitos (solo números).`
            : `${name}: confirma el mismo PIN.`
    } else if (mode === 'change') {
      if (title) title.textContent = opts?.changeStep === 2 ? 'PIN nuevo' : 'PIN actual'
      if (sub)
        sub.textContent =
          opts?.changeStep === 2
            ? `${name}: introduce el PIN nuevo (4 dígitos).`
            : `${name}: introduce tu PIN actual.`
    } else {
      if (title) title.textContent = 'Acceso camarera'
      if (sub)
        sub.textContent = `${name}: introduce tu PIN para esta jornada.`
    }
    paintDots('waiterGateDots', 0)
    paintDots('waiterGateDots2', 0)
    const row2 = $('waiterGateDots2Row')
    if (row2) row2.hidden = mode !== 'change' || opts?.changeStep !== 2
    if ($('waiterGateErr')) $('waiterGateErr').textContent = ''
    gate.hidden = false
    document.body.classList.add('waiter-pin-open')
    return new Promise((resolve, reject) => {
      resolveFlow = resolve
      rejectFlow = reject
    })
  }

  function closeModal(result) {
    const gate = $('waiterGate')
    if (gate) gate.hidden = true
    document.body.classList.remove('waiter-pin-open')
    const r = resolveFlow
    resolveFlow = null
    rejectFlow = null
    if (typeof r === 'function') r(result)
  }

  function cancelModal() {
    const rej = rejectFlow
    closeModal(false)
    if (typeof rej === 'function') rej(new Error('cancelled'))
  }

  function failPin(msg) {
    pinBuf = ''
    paintDots('waiterGateDots', 0)
    if ($('waiterGateErr')) $('waiterGateErr').textContent = msg || 'PIN incorrecto'
    $('waiterGate')?.animate?.(
      [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }],
      { duration: 260 },
    )
  }

  async function submitPinFlow() {
    if (!modalWaiter?.id) return
    const id = modalWaiter.id

    if (modalMode === 'verify') {
      const { ok, data } = await apiPost({ action: 'verify', waiterId: id, pin: pinBuf })
      if (!ok) {
        failPin(data?.error || 'PIN incorrecto')
        return
      }
      closeModal(true)
      return
    }

    if (modalMode === 'setup') {
      if (setupStep === 1) {
        pinBuf2 = pinBuf
        pinBuf = ''
        setupStep = 2
        paintDots('waiterGateDots', 0)
        if ($('waiterGateTitle')) $('waiterGateTitle').textContent = 'Repite el PIN'
        if ($('waiterGateSub'))
          $('waiterGateSub').textContent = `${modalWaiter.name}: confirma el mismo PIN.`
        return
      }
      if (pinBuf !== pinBuf2) {
        failPin('No coincide — vuelve a empezar')
        pinBuf2 = ''
        setupStep = 1
        if ($('waiterGateTitle')) $('waiterGateTitle').textContent = 'Crea tu PIN'
        return
      }
      const { ok, data } = await apiPost({
        action: 'setup',
        waiterId: id,
        pin: pinBuf,
        pinConfirm: pinBuf2,
      })
      if (!ok) {
        failPin(data?.error || 'No se pudo guardar')
        if (data?.error?.includes('Ya tiene')) setupStep = 1
        return
      }
      closeModal(true)
      return
    }

    if (modalMode === 'change') {
      const step = modalWaiter.__changeStep || 1
      if (step === 1) {
        const { ok, data } = await apiPost({
          action: 'verify',
          waiterId: id,
          pin: pinBuf,
        })
        if (!ok) {
          failPin(data?.error || 'PIN actual incorrecto')
          return
        }
        modalWaiter.__changeOld = pinBuf
        modalWaiter.__changeStep = 2
        pinBuf = ''
        paintDots('waiterGateDots', 0)
        if ($('waiterGateTitle')) $('waiterGateTitle').textContent = 'PIN nuevo'
        if ($('waiterGateSub'))
          $('waiterGateSub').textContent = `${modalWaiter.name}: PIN nuevo (4 dígitos).`
        return
      }
      const newPin = pinBuf
      const { ok, data } = await apiPost({
        action: 'change',
        waiterId: id,
        currentPin: modalWaiter.__changeOld,
        newPin,
      })
      delete modalWaiter.__changeStep
      delete modalWaiter.__changeOld
      if (!ok) {
        failPin(data?.error || 'No se pudo cambiar')
        return
      }
      closeModal(true)
      return
    }
  }

  function onPinKey(k) {
    if ($('waiterGate')?.hidden) return
    if ($('waiterGateErr')) $('waiterGateErr').textContent = ''
    if (k === 'clear') {
      pinBuf = pinBuf.slice(0, -1)
      paintDots('waiterGateDots', pinBuf.length)
      return
    }
    if (k === 'ok') {
      if (pinBuf.length === 4) submitPinFlow()
      return
    }
    if (!/^\d$/.test(k) || pinBuf.length >= 4) return
    pinBuf += k
    paintDots('waiterGateDots', pinBuf.length)
    if (pinBuf.length === 4) setTimeout(submitPinFlow, 80)
  }

  function bindUi() {
    $('waiterGatePad')?.addEventListener('click', (e) => {
      const b = e.target.closest('[data-wk]')
      if (!b) return
      onPinKey(b.dataset.wk)
    })
    $('waiterGateCancel')?.addEventListener('click', () => cancelModal())
    window.addEventListener('keydown', (e) => {
      if ($('waiterGate')?.hidden) return
      if (e.key === 'Escape') {
        e.preventDefault()
        cancelModal()
        return
      }
      if (e.key === 'Backspace') {
        e.preventDefault()
        onPinKey('clear')
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        onPinKey('ok')
        return
      }
      if (/^\d$/.test(e.key)) onPinKey(e.key)
    })
  }

  /**
   * Devuelve true si la camarera puede operar en la jornada abierta.
   * @param {number|null} startedAt — j.startedAt
   */
  async function ensureUnlocked(waiterId, waiterName, startedAt) {
    const id = String(waiterId || '').trim()
    if (!id) {
      alert('Elige camarera en el plano de mesas antes de tomar pedido.')
      return false
    }
    if (!startedAt) return true
    if (isUnlocked(id, startedAt)) return true

    const waiter = { id, name: waiterName || id }
    let hasPin = false
    try {
      hasPin = await apiGetHasPin(id)
    } catch (err) {
      alert(err.message || 'No se pudo comprobar el PIN')
      return false
    }

    try {
      if (!hasPin) {
        await showModal('setup', waiter)
      } else {
        await showModal('verify', waiter)
      }
    } catch {
      return false
    }

    markUnlocked(id, startedAt)
    return true
  }

  async function promptChangePin(waiterId, waiterName) {
    const id = String(waiterId || '').trim()
    if (!id) {
      alert('Elige una camarera.')
      return false
    }
    const waiter = { id, name: waiterName || id, __changeStep: 1 }
    try {
      const hasPin = await apiGetHasPin(id)
      if (!hasPin) {
        await showModal('setup', waiter)
        return true
      }
      await showModal('change', waiter, { changeStep: 1 })
      return true
    } catch {
      return false
    }
  }

  async function deletePinForWaiter(waiterId) {
    try {
      await apiPost({ action: 'delete', waiterId: String(waiterId || '') })
    } catch {}
  }

  loadUnlockStore()
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindUi)
  } else {
    bindUi()
  }

  window.CasaTorinoWaiterPin = {
    ensureUnlocked,
    isUnlocked,
    markUnlocked,
    onJornadaChange,
    clearUnlockStore,
    promptChangePin,
    deletePinForWaiter,
  }
})()
