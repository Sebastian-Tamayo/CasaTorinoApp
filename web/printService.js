/**
 * Casa Torino — impresión térmica ESC/POS vía QZ Tray
 * Impresora: POS-58 (58 mm) · nombre exacto en Windows
 *
 * Requisito en el PC: QZ Tray instalado y abierto.
 * https://qz.io/download
 *
 * Para no ver "Action Required / Untrusted website":
 * 1) Marca "Remember this decision" y pulsa Allow (rápido), o
 * 2) Copia assets/qz/digital-certificate.txt → %APPDATA%\\qz\\override.crt
 *    (ver assets/qz/LEEME-QUITAR-AVISO.txt)
 */
(() => {
  const PRINTER_NAME = 'POS-58'
  const PRINTER_ALIASES = [
    /^POS-58$/i,
    /^POS\s*58$/i,
    /^POS58$/i,
    /POS[-_\s]?58/i,
  ]

  const BUSINESS = {
    name: 'CASA TORINO',
    subtitle: 'Bar · Restaurante',
    footer: '¡Gracias por su visita!',
    /** Ancho útil aprox. en caracteres (fuente A, 58 mm) */
    cols: 32,
  }

  /** Comandos ESC/POS */
  const ESC = {
    INIT: '\x1B\x40',
    /** Página de códigos PC858 (Epson table 19) — € y tildes */
    CP858: '\x1B\x74\x13',
    ALIGN_LEFT: '\x1B\x61\x00',
    ALIGN_CENTER: '\x1B\x61\x01',
    BOLD_ON: '\x1B\x45\x01',
    BOLD_OFF: '\x1B\x45\x00',
    SIZE_NORMAL: '\x1D\x21\x00',
    SIZE_DOUBLE: '\x1D\x21\x11',
    CUT: '\x1D\x56\x00',
    /** Abrir cajón pin 2 (estándar ESC p) — si no hay cajón, se ignora */
    DRAWER: '\x1B\x70\x00\x19\xFA',
    LF: '\n',
  }

  const STORAGE_KEY = 'casa-torino-printer-v1'
  let connecting = null
  let trustedSetupDone = false

  function money(n) {
    return (Math.round((+n + Number.EPSILON) * 100) / 100)
      .toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  function line(char = '-') {
    return char.repeat(BUSINESS.cols)
  }

  function padRow(left, right) {
    const L = String(left)
    const R = String(right)
    const space = Math.max(1, BUSINESS.cols - L.length - R.length)
    return L + ' '.repeat(space) + R
  }

  function wrapName(name, max = 20) {
    const s = String(name || '')
    if (s.length <= max) return s
    return s.slice(0, max - 1) + '…'
  }

  function rememberPrinter(name) {
    try {
      if (name) localStorage.setItem(STORAGE_KEY, String(name))
    } catch {}
  }

  function rememberedPrinter() {
    try {
      return localStorage.getItem(STORAGE_KEY) || ''
    } catch {
      return ''
    }
  }

  /**
   * Certificado + firma → QZ deja de marcar el sitio como Untrusted
   * (con override.crt instalado en el PC, o Allow+Remember).
   */
  function setupQzTrust() {
    if (trustedSetupDone || typeof qz === 'undefined') return
    trustedSetupDone = true
    try {
      if (qz.api && typeof qz.api.setPromiseType === 'function') {
        qz.api.setPromiseType((resolver) => new Promise(resolver))
      }
      if (qz.security && typeof qz.security.setCertificatePromise === 'function') {
        qz.security.setCertificatePromise((resolve, reject) => {
          fetch('/assets/qz/digital-certificate.txt', {
            cache: 'no-store',
            headers: { Accept: 'text/plain' },
          })
            .then((r) => {
              if (!r.ok) throw new Error('cert ' + r.status)
              return r.text()
            })
            .then((cert) => resolve(cert))
            .catch((err) => {
              console.warn('[printService] certificate', err)
              resolve()
            })
        })
      }
      if (qz.security && typeof qz.security.setSignatureAlgorithm === 'function') {
        try {
          qz.security.setSignatureAlgorithm('SHA512')
        } catch (_) {}
      }
      if (qz.security && typeof qz.security.setSignaturePromise === 'function') {
        qz.security.setSignaturePromise((toSign) => {
          return (resolve, reject) => {
            fetch('/api/qz-sign', {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'Content-Type': 'text/plain; charset=utf-8' },
              body: String(toSign || ''),
            })
              .then((r) => {
                if (!r.ok) throw new Error('qz-sign ' + r.status)
                return r.text()
              })
              .then((sig) => resolve(sig))
              .catch((err) => {
                console.warn('[printService] signature', err)
                reject(err)
              })
          }
        })
      }
    } catch (err) {
      console.warn('[printService] trust setup', err)
    }
  }

  async function ensureConnected() {
    if (typeof qz === 'undefined') {
      throw new Error('QZ_MISSING')
    }
    setupQzTrust()
    if (qz.websocket.isActive()) return
    if (connecting) return connecting
    connecting = qz.websocket
      .connect()
      .catch((err) => {
        connecting = null
        throw err
      })
      .then(() => {
        connecting = null
      })
    return connecting
  }

  function matchesPos58(name) {
    const n = String(name || '').trim()
    if (!n) return false
    return PRINTER_ALIASES.some((re) => re.test(n))
  }

  /**
   * Construye el ticket ESC/POS (58 mm).
   */
  function buildReceipt(cartItems, total, meta = {}) {
    const now = new Date()
    const when = now.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    const items = Array.isArray(cartItems) ? cartItems : []

    const data = []
    data.push(ESC.INIT)
    data.push(ESC.CP858)
    data.push(ESC.ALIGN_CENTER)
    data.push(ESC.SIZE_DOUBLE)
    data.push(ESC.BOLD_ON)
    data.push(BUSINESS.name + ESC.LF)
    data.push(ESC.SIZE_NORMAL)
    data.push(ESC.BOLD_OFF)
    data.push(BUSINESS.subtitle + ESC.LF)
    data.push(when + ESC.LF)
    if (meta.mesa) data.push(`Mesa ${meta.mesa}` + ESC.LF)
    data.push(ESC.ALIGN_LEFT)
    data.push(line('=') + ESC.LF)

    for (const it of items) {
      const qty = +it.qty || 0
      const price = +it.price || 0
      const sum = qty * price
      data.push(padRow(`${qty}x ${wrapName(it.name)}`, money(sum)) + ESC.LF)
      if (qty > 1) {
        data.push(`  ${money(price)} / ud.` + ESC.LF)
      }
    }

    if (meta.notes) {
      data.push(line('-') + ESC.LF)
      data.push(ESC.BOLD_ON)
      data.push('Notas:' + ESC.LF)
      data.push(ESC.BOLD_OFF)
      const note = String(meta.notes).replace(/\s+/g, ' ').trim()
      let rest = note
      while (rest.length) {
        data.push(rest.slice(0, BUSINESS.cols) + ESC.LF)
        rest = rest.slice(BUSINESS.cols)
      }
    }

    data.push(line('-') + ESC.LF)
    const ivaRate = Number.isFinite(meta.ivaRate) ? meta.ivaRate : 0.1
    let base = Number(meta.base)
    let iva = Number(meta.iva)
    if (!Number.isFinite(base) || !Number.isFinite(iva)) {
      base = Math.round((total / (1 + ivaRate) + Number.EPSILON) * 100) / 100
      iva = Math.round((total - base + Number.EPSILON) * 100) / 100
    }
    data.push(padRow('Base', money(base) + ' E') + ESC.LF)
    data.push(padRow('IVA ' + Math.round(ivaRate * 100) + '%', money(iva) + ' E') + ESC.LF)
    data.push(ESC.BOLD_ON)
    data.push(ESC.SIZE_DOUBLE)
    data.push(padRow('TOTAL', money(total)) + ESC.LF)
    data.push(ESC.SIZE_NORMAL)
    data.push(ESC.BOLD_OFF)

    const paid =
      meta.paid !== undefined && meta.paid !== ''
        ? parseFloat(String(meta.paid).replace(',', '.'))
        : NaN
    if (Number.isFinite(paid)) {
      data.push(padRow('Entrega', money(paid) + ' E') + ESC.LF)
      const change = Number.isFinite(meta.change) ? meta.change : paid - total
      data.push(padRow('Cambio', money(change) + ' E') + ESC.LF)
    }

    data.push(line('=') + ESC.LF)
    data.push(ESC.ALIGN_CENTER)
    data.push(BUSINESS.footer + ESC.LF)
    data.push(ESC.LF)
    data.push(ESC.LF)
    data.push(ESC.CUT)
    // Solo abrir cajón si se pide explícitamente (p.ej. al cobrar)
    if (meta.openDrawer === true) data.push(ESC.DRAWER)
    return data
  }

  async function listPrinterNames() {
    try {
      const list = await qz.printers.find()
      if (Array.isArray(list)) return list.map(String)
      if (list) return [String(list)]
    } catch (_) {}
    return []
  }

  async function findPrinter() {
    // 1) Nombre exacto POS-58 (lo que pide Windows/QZ)
    try {
      const exact = await qz.printers.find(PRINTER_NAME)
      if (exact) {
        const name = Array.isArray(exact) ? exact[0] : exact
        if (name) {
          rememberPrinter(name)
          return String(name)
        }
      }
    } catch (_) {}

    // 2) Buscar en la lista por alias / recuerdo
    const names = await listPrinterNames()
    const remembered = rememberedPrinter()
    if (remembered) {
      const hit = names.find((n) => String(n) === remembered)
      if (hit) return hit
    }
    const match = names.find((n) => matchesPos58(n))
    if (match) {
      rememberPrinter(match)
      return match
    }

    // 3) Último recurso: predeterminada del sistema
    try {
      const def = await qz.printers.getDefault()
      if (def) return String(def)
    } catch (_) {}
    return names[0] || null
  }

  function qzPrintErrorAlert(err) {
    const msg = String(err && (err.message || err))
    if (msg.includes('QZ_MISSING') || /websocket|connect|ECONNREFUSED|not connected|Unable to establish/i.test(msg)) {
      alert('No se pudo conectar con QZ Tray.\nÁbrelo en el PC de la caja e inténtalo de nuevo.')
    } else if (/denied|blocked|not trusted|cancelled|canceled|reject/i.test(msg)) {
      alert(
        'QZ Tray no confía aún en este sitio.\n' +
          'En el aviso de QZ Tray pulsa «Allow» / «Permitir»\n' +
          'y marca recordar para casa-torino-web.vercel.app',
      )
    } else {
      alert('No se pudo imprimir en POS-58.\n' + (msg || 'Error desconocido'))
    }
  }

  /**
   * Imprime ticket. Abrir cajón solo si meta.openDrawer === true.
   * No lanza si falla: muestra alerta amigable.
   */
  async function printReceipt(cartItems, total, meta = {}) {
    try {
      await ensureConnected()
      const printer = await findPrinter()
      if (!printer) {
        alert(
          'No se encontró la impresora POS-58.\n' +
            'Comprueba que esté encendida, instalada en Windows\n' +
            'y que QZ Tray esté abierto.',
        )
        return false
      }

      const config = qz.configs.create(printer, {
        encoding: 'CP858',
        copies: 1,
        // Raw ESC/POS → no usa driver gráfico
        rasterize: false,
      })
      const data = buildReceipt(cartItems, total, meta).map((chunk) => ({
        type: 'raw',
        format: 'command',
        data: chunk,
      }))
      // Algunas versiones de QZ aceptan strings directos; si falla raw-object, reintento clásico
      try {
        await qz.print(config, data)
      } catch (err1) {
        const plain = buildReceipt(cartItems, total, meta)
        await qz.print(config, plain)
      }
      rememberPrinter(printer)
      return true
    } catch (err) {
      console.warn('[printService]', err)
      qzPrintErrorAlert(err)
      return false
    }
  }

  /** Solo abre el cajón (sin imprimir ticket). */
  async function openCashDrawer() {
    try {
      await ensureConnected()
      const printer = await findPrinter()
      if (!printer) return false
      const config = qz.configs.create(printer, {
        encoding: 'CP858',
        copies: 1,
        rasterize: false,
      })
      const chunks = [ESC.INIT, ESC.DRAWER]
      const data = chunks.map((chunk) => ({
        type: 'raw',
        format: 'command',
        data: chunk,
      }))
      try {
        await qz.print(config, data)
      } catch (_) {
        await qz.print(config, chunks)
      }
      rememberPrinter(printer)
      return true
    } catch (err) {
      console.warn('[printService] drawer', err)
      // No bloquear el cobro si el cajón falla
      return false
    }
  }

  /** Prueba rápida: imprime un ticket de prueba en POS-58 */
  async function testPrint() {
    return printReceipt(
      [{ name: 'Prueba POS-58', qty: 1, price: 0 }],
      0,
      { mesa: 'TEST', notes: 'Impresión de prueba Casa Torino' },
    )
  }

  async function resolvePrinterName() {
    await ensureConnected()
    return findPrinter()
  }

  window.CasaTorinoPrint = {
    printReceipt,
    openCashDrawer,
    testPrint,
    ensureConnected,
    buildReceipt,
    resolvePrinterName,
    PRINTER_NAME,
  }
})()
