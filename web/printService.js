/**
 * Casa Torino — impresión térmica ESC/POS vía QZ Tray
 * Impresora: PREMIER ITP-85 (80 mm) · Cajón RJ11 en impresora
 *
 * Requisito en el PC Windows: QZ Tray instalado y abierto.
 * https://qz.io/download
 */
(() => {
  const BUSINESS = {
    name: 'CASA TORINO',
    subtitle: 'Bar · Restaurante',
    footer: '¡Gracias por su visita!',
    /** Ancho útil aprox. en caracteres (fuente A, 80 mm) */
    cols: 42,
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
    /** Abrir cajón pin 2 (estándar ESC p) */
    DRAWER: '\x1B\x70\x00\x19\xFA',
    LF: '\n',
  }

  let connecting = null

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

  function wrapName(name, max = 28) {
    const s = String(name || '')
    if (s.length <= max) return s
    return s.slice(0, max - 1) + '…'
  }

  async function ensureConnected() {
    if (typeof qz === 'undefined') {
      throw new Error('QZ_MISSING')
    }
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

  /**
   * Construye el ticket ESC/POS.
   * @param {Array<{name:string, qty:number, price:number}>} cartItems
   * @param {number} total
   * @param {{ mesa?: string, paid?: number|string, change?: number }} [meta]
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
        data.push(`    ${money(price)} / ud.` + ESC.LF)
      }
    }

    data.push(line('-') + ESC.LF)
    data.push(ESC.BOLD_ON)
    data.push(ESC.SIZE_DOUBLE)
    data.push(padRow('TOTAL', money(total) + ' EUR') + ESC.LF)
    data.push(ESC.SIZE_NORMAL)
    data.push(ESC.BOLD_OFF)

    const paid = meta.paid !== undefined && meta.paid !== '' ? parseFloat(String(meta.paid).replace(',', '.')) : NaN
    if (Number.isFinite(paid)) {
      data.push(padRow('Entrega', money(paid) + ' EUR') + ESC.LF)
      const change = Number.isFinite(meta.change) ? meta.change : paid - total
      data.push(padRow('Cambio', money(change) + ' EUR') + ESC.LF)
    }

    data.push(line('=') + ESC.LF)
    data.push(ESC.ALIGN_CENTER)
    data.push(BUSINESS.footer + ESC.LF)
    data.push(ESC.LF)
    data.push(ESC.LF)
    data.push(ESC.CUT)
    data.push(ESC.DRAWER)
    return data
  }

  async function findPrinter() {
    // Preferir la térmica PREMIER si está en la lista; si no, la predeterminada
    try {
      const list = await qz.printers.find()
      const names = Array.isArray(list) ? list : [list]
      const match = names.find((n) => /premier|itp-?85|thermal|termica|receipt|ticket/i.test(String(n)))
      if (match) return match
    } catch (_) {}
    try {
      return await qz.printers.getDefault()
    } catch (_) {
      return null
    }
  }

  /**
   * Imprime ticket + abre cajón.
   * No lanza si falla: muestra alerta amigable.
   */
  async function printReceipt(cartItems, total, meta = {}) {
    try {
      await ensureConnected()
      const printer = await findPrinter()
      if (!printer) {
        alert('No se encontró ninguna impresora.\nRevisa que la PREMIER ITP-85 esté instalada en Windows.')
        return false
      }

      const config = qz.configs.create(printer, {
        encoding: 'CP858',
        copies: 1,
      })
      const data = buildReceipt(cartItems, total, meta)
      await qz.print(config, data)
      return true
    } catch (err) {
      console.warn('[printService]', err)
      const msg = String(err && (err.message || err))
      if (msg.includes('QZ_MISSING') || /websocket|connect|ECONNREFUSED|not connected|Unable to establish/i.test(msg)) {
        alert('No se pudo conectar con la impresora. ¿Está QZ Tray abierto?')
      } else {
        alert('No se pudo imprimir el ticket.\n' + (msg || 'Error desconocido'))
      }
      return false
    }
  }

  // API usada por tpv.html → botón Cobrado
  window.CasaTorinoPrint = {
    printReceipt,
    ensureConnected,
    buildReceipt,
  }
})()
