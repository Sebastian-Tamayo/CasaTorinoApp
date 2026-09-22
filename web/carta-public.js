/* Renderiza carta pública (misma fuente que el TPV: /api/carta → fallback JSON). */
(() => {
  const money = (n) =>
    Number(n).toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + '\u00a0€'

  const escapeHtml = (s) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')

  const SECTION_META = {
    colombia: { icon: 'fa-pepper-hot', title: 'Especialidades colombianas', listClass: 'dish-list' },
    picoteo: { icon: 'fa-bowl-food', title: 'Picoteo y entrantes', listClass: 'dish-list' },
    espana: { icon: 'fa-fish', title: 'España y platos variados', listClass: 'dish-list' },
    combinados: { icon: 'fa-plate-wheat', title: 'Combinados', listClass: 'dish-list single-col' },
    infantil: { icon: 'fa-child-reaching', title: 'Menú infantil', listClass: 'dish-list single-col' },
    postres: { icon: 'fa-ice-cream', title: 'Postres', listClass: 'dish-list' },
    bebidas: { icon: 'fa-wine-glass', title: 'Bebidas', listClass: 'dish-list compact single-col' },
    cafes: { icon: 'fa-mug-hot', title: 'Cafés', listClass: 'dish-list compact single-col' },
  }

  /** Bebidas «especiales» (columna izquierda); el resto va a barra. */
  const BEBIDAS_ESPECIALES = new Set([
    'bebidas-batidos-naturales',
    'bebidas-limonada-de-coco',
    'bebidas-michelada-de-mango',
    'bebidas-zumo-de-naranja-natural',
    'bebidas-limonada-natural',
    'bebidas-jarra-de-aguapanela',
  ])

  function fillMenuDia(meta) {
    const ul = document.querySelector('.menu-precios')
    if (!ul || !meta?.menuDay) return
    const w = meta.menuDay.weekday
    const e = meta.menuDay.weekend
    if (!w || !e) return
    ul.innerHTML = `
      <li>
        <span class="mp-label">Entre semana</span>
        <span class="mp-detail">Colombiano <em>${escapeHtml(w.co)}\u00a0€</em> · Español <em>${escapeHtml(w.es)}\u00a0€</em></span>
      </li>
      <li>
        <span class="mp-label">Fin de semana y festivos</span>
        <span class="mp-detail">Colombiano <em>${escapeHtml(e.co)}\u00a0€</em> · Español <em>${escapeHtml(e.es)}\u00a0€</em></span>
      </li>`
    const copy = document.querySelector('.menu-dia-copy p')
    if (copy && window.CasaTorinoCarta?.isWeekendMenuDay) {
      const info = window.CasaTorinoCarta.isWeekendMenuDay(meta)
      if (info.reason === 'holiday' && info.festivo?.name) {
        copy.textContent =
          `Hoy es festivo en Gijón (${info.festivo.name}): aplica tarifa de fin de semana.`
      }
    }
  }

  function dishLi(it) {
    const price = money(it.price)
    const desc = it.desc
      ? `<span>${escapeHtml(it.desc)}</span>`
      : ''
    const star = it.star ? ' class="dish-star"' : ''
    const badge = it.star ? '<em class="star-badge">Siempre</em>' : ''
    return `<li${star}><div class="dish-top"><strong>${badge}${escapeHtml(it.name)}</strong><b class="price">${price}</b></div>${desc}</li>`
  }

  function listHtml(items, listClass) {
    const clean = (items || []).filter((it) => it && !it.customProduct)
    if (!clean.length) {
      return `<p class="carta-empty">No hay platos en esta sección.</p>`
    }
    const lis = clean.map(dishLi).join('')
    return `<ul class="${listClass}">${lis}</ul>`
  }

  function bebidasBody(items) {
    const clean = (items || []).filter((it) => it && !it.customProduct)
    if (!clean.length) {
      return `<p class="carta-empty">No hay bebidas en carta.</p>`
    }
    const especiales = clean.filter(
      (it) =>
        BEBIDAS_ESPECIALES.has(it.id) ||
        String(it.group || '').toLowerCase() === 'especiales',
    )
    const barra = clean.filter((it) => !especiales.includes(it))
    const left = especiales.length ? especiales : clean.slice(0, Math.min(6, clean.length))
    const right = especiales.length ? barra : clean.slice(left.length)
    const leftBlock = left.length
      ? `<div><h4>Especiales</h4>${listHtml(left, 'dish-list compact single-col')}</div>`
      : ''
    const rightBlock = right.length
      ? `<div><h4>Barra</h4>${listHtml(right, 'dish-list compact single-col')}</div>`
      : ''
    return `<div class="bebidas-grid">${leftBlock}${rightBlock}</div>`
  }

  function fillCarta(data) {
    const cats = data.categories || []
    const nav = document.getElementById('cartaNav')
    const grid = document.querySelector('.carta-grid')
    if (!nav || !grid) return

    const byId = Object.fromEntries(cats.map((c) => [c.id, c]))
    // Colombia es el sello: siempre primero en la carta pública.
    let sections = (data.publicSections || []).filter((id) => byId[id])
    if (!sections.length) {
      sections = cats
        .map((c) => c.id)
        .filter((id) => id && id !== 'menus-dia' && id !== 'extras')
    }
    if (byId.colombia) {
      sections = ['colombia', ...sections.filter((id) => id !== 'colombia')]
    }
    // Ocultar secciones sin platos públicos (p.ej. tras borrar todo en el TPV)
    sections = sections.filter((id) => {
      const items = (byId[id]?.items || []).filter((it) => it && !it.customProduct)
      return items.length > 0
    })
    if (!sections.length) {
      nav.innerHTML = ''
      grid.innerHTML =
        '<p class="carta-empty" style="padding:1.25rem">La carta se está actualizando. Vuelve en un momento.</p>'
      return
    }

    nav.innerHTML = sections
      .map((id, i) => {
        const c = byId[id]
        const sello = id === 'colombia' ? ' sello' : ''
        const label =
          id === 'colombia' ? 'Colombia <em>Sello</em>' : escapeHtml(c.name)
        return `<button type="button" data-target="${escapeHtml(id)}" class="${i === 0 ? 'active' : ''}${sello}">${label}</button>`
      })
      .join('')

    grid.innerHTML = sections
      .map((id, i) => {
        const c = byId[id]
        const meta = SECTION_META[id] || {
          icon: c.icon || 'fa-utensils',
          title: c.name,
          listClass: 'dish-list',
        }
        const featured = id === 'colombia' ? ' featured sello-block' : ''
        const wide = id === 'bebidas' ? ' wide' : ''
        const selloLine =
          id === 'colombia'
            ? '<p class="carta-sello"><i class="fa-solid fa-certificate" aria-hidden="true"></i> Nuestro sello · especialidad de la casa</p>'
            : ''
        const title = meta.title || c.name
        const icon = String(meta.icon || '').replace(/^fa-/, '')
        const body =
          id === 'bebidas'
            ? bebidasBody(c.items)
            : listHtml(c.items, meta.listClass)
        return `<article class="carta-block${featured}${wide}${i === 0 ? ' is-active' : ''}" id="${escapeHtml(id)}">
          ${selloLine}
          <h3><i class="fa-solid fa-${escapeHtml(icon)}"></i> ${escapeHtml(title)}</h3>
          <div class="carta-scroll">${body}</div>
        </article>`
      })
      .join('')

    // Rebind nav (main.js may have run earlier)
    const blocks = Array.from(document.querySelectorAll('.carta-block'))
    function show(targetId) {
      blocks.forEach((b) => b.classList.toggle('is-active', b.id === targetId))
      nav.querySelectorAll('button').forEach((btn) => {
        btn.classList.toggle('active', btn.getAttribute('data-target') === targetId)
      })
    }
    nav.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-target')
        if (!id) return
        show(id)
        document.getElementById('carta')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    })
  }

  async function loadCartaData() {
    try {
      const r = await fetch('/api/carta', {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
      if (r.ok) return r.json()
    } catch (err) {
      console.warn('[carta pública] api', err)
    }
    const r2 = await fetch('data/carta.json', { cache: 'no-store' })
    if (!r2.ok) return null
    return r2.json()
  }

  async function boot() {
    try {
      const data = await loadCartaData()
      if (!data) return
      fillMenuDia(data)
      fillCarta(data)
    } catch (err) {
      console.warn('[carta pública]', err)
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot)
  } else {
    boot()
  }
})()
