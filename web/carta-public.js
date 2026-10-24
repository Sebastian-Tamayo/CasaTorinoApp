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

  /** @type {Map<string, object>} */
  let dishById = new Map()

  function fillMenuDia(data) {
    const wrap = document.querySelector('.hero-menus')
    const ul = document.querySelector('.menu-precios')
    if (!ul || !data?.menuDay) {
      void setupMenusAnteriores(data)
      return
    }

    const kindInfo =
      window.CasaTorinoCarta?.menuDayKind?.(data) ||
      window.CasaTorinoCarta?.isWeekendMenuDay?.(data) || {
        kind: 'weekday',
        schedule: 'weekday',
        reason: 'weekday',
      }
    const schedule =
      kindInfo.schedule ||
      (kindInfo.kind === 'saturday'
        ? 'saturday'
        : kindInfo.kind === 'sunday' || kindInfo.reason === 'holiday'
          ? 'sunday'
          : 'weekday')

    const md = data.menuDay || {}
    const sat = md.saturday || {}
    const sun = md.sunday || {}
    const week = md.weekday || {}
    // Compat con carta antigua (weekend.es / weekend.co)
    // Precios fijos de respaldo: semana 13 · sábado 16 · domingo 18 (nunca 19)
    const satPrice = Number(sat.price)
    const sunPrice = Number(sun.price)
    const weekPrice = Number(week.price ?? week.unified)
    const satP = Number.isFinite(satPrice) ? satPrice : 16
    const sunP = Number.isFinite(sunPrice) ? sunPrice : 18
    const weekP = Number.isFinite(weekPrice) ? weekPrice : 13
    const price =
      schedule === 'saturday' ? satP : schedule === 'sunday' ? sunP : weekP

    ul.innerHTML = `
      <li>
        <span class="mp-label">Hoy · menú del día</span>
        <span class="mp-detail"><em>${escapeHtml(price)}\u00a0€</em></span>
      </li>`

    const copy = document.querySelector('.menu-dia-copy p')
    if (copy) copy.textContent = 'Menú del día.'

    // Fotos del menú (mismas image_url que se adjuntan en Editar Carta del TPV)
    let gallery = document.querySelector('.menu-dia-gallery')
    if (!gallery && wrap) {
      gallery = document.createElement('div')
      gallery.className = 'menu-dia-gallery'
      gallery.setAttribute('aria-label', 'Ver menú del día')
      wrap.appendChild(gallery)
    }
    if (!gallery) {
      void setupMenusAnteriores(data)
      return
    }

    const menus = (data.categories || []).find((c) => c && c.id === 'menus-dia')
    const order = [
      'menu-dia-unificado-semana',
      'menu-dia-co-finde',
      'menu-dia-es-finde',
      'menu-dia-sabado',
      'menu-dia-domingo',
    ]
    const itemSchedule = (it) =>
      window.CasaTorinoCarta?.menuItemSchedule?.(it) || ''

    const labelFor = () => ({ eyebrow: 'Hoy', title: 'Menú del día' })

    let items = (menus?.items || []).filter(
      (it) =>
        it &&
        it.image_url &&
        !it.customProduct &&
        itemSchedule(it) === schedule,
    )
    items = [...items].sort((a, b) => {
      const ia = order.indexOf(a.id)
      const ib = order.indexOf(b.id)
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
    })

    if (!items.length) {
      gallery.hidden = true
      gallery.innerHTML = ''
      wrap?.classList.remove('has-menu-photos')
    } else {
      wrap?.classList.add('has-menu-photos')
      gallery.hidden = false
      gallery.style.setProperty('--menu-foto-cols', String(Math.min(3, items.length)))
      gallery.innerHTML = items
        .map((it, i) => {
          const labels = labelFor()
          return `<button type="button" class="menu-dia-foto is-today" style="--i:${i}" data-dish-id="${escapeHtml(it.id)}" aria-label="Ver ${escapeHtml(labels.title)}">
          <img src="${escapeHtml(it.image_url)}" alt="${escapeHtml(labels.title)}" loading="lazy" decoding="async" />
          <em>${escapeHtml(labels.eyebrow)}</em>
          <strong>${escapeHtml(labels.title)}</strong>
          <b>${money(it.price)}</b>
          <span class="menu-dia-foto-cta">Ver menú <em>(pincha aquí)</em></span>
        </button>`
        })
        .join('')

      gallery.querySelectorAll('button[data-dish-id]').forEach((el) => {
        el.addEventListener('click', () => {
          const id = el.getAttribute('data-dish-id')
          const it = id ? dishById.get(id) : null
          if (it?.image_url) openDishModal(it, { menuSheet: true })
        })
      })
    }

    // Siempre: la galería histórica no depende de que hoy haya foto de menú
    void setupMenusAnteriores(data)
  }

  /**
   * Galería «Menús anteriores»: SOLO fotos subidas a propósito desde el TPV
   * (plato Menús anteriores / menusAnteriores). Nunca carteles del menú del día
   * ni la carta pública.
   */
  async function setupMenusAnteriores(data) {
    const btn = document.getElementById('menusAnterioresBtn')
    const panel = document.getElementById('menusAnterioresPanel')
    const grid = document.getElementById('menusAnterioresGrid')
    if (!btn || !panel || !grid) return

    const urls = []
    const push = (u) => {
      const src = String(u || '').trim()
      if (!src || src.startsWith('data:')) return
      if (urls.includes(src)) return
      urls.push(src)
    }

    if (Array.isArray(data?.menusAnteriores)) {
      data.menusAnteriores.forEach(push)
    }

    if (!urls.length) {
      grid.innerHTML =
        '<p class="menus-anteriores-empty">Pronto verás aquí fotos de menús de días pasados.</p>'
    } else {
      grid.innerHTML = urls
        .slice(0, 24)
        .map(
          (src, i) =>
            `<button type="button" style="--i:${i}" data-menu-photo="${escapeHtml(src)}" aria-label="Ver foto del menú">
              <img src="${escapeHtml(src)}" alt="" loading="lazy" decoding="async" />
            </button>`,
        )
        .join('')
      grid.querySelectorAll('button[data-menu-photo]').forEach((el) => {
        el.addEventListener('click', () => {
          const src = el.getAttribute('data-menu-photo')
          if (src) openPhotoOnly(src)
        })
      })
    }

    if (btn.dataset.bound === '1') return
    btn.dataset.bound = '1'
    btn.addEventListener('click', () => {
      const open = panel.hidden
      panel.hidden = !open
      btn.setAttribute('aria-expanded', open ? 'true' : 'false')
      const cta = btn.querySelector('em')
      if (cta) cta.textContent = open ? 'Ocultar' : 'Ver fotos'
      if (open) {
        try {
          panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        } catch {}
      }
    })
  }

  function openPhotoOnly(src) {
    const url = String(src || '').trim()
    if (!url) return
    openDishModal(
      { id: 'menu-foto', name: '', price: 0, image_url: url, desc: '' },
      { menuSheet: true, photoOnly: true, forceModal: true },
    )
  }

  function dishLi(it) {
    const price = money(it.price)
    const desc = it.desc
      ? `<span class="dish-desc">${escapeHtml(it.desc)}</span>`
      : ''
    const star = it.star ? ' dish-star' : ''
    const badge = it.star ? '<em class="star-badge">Siempre</em>' : ''
    const hasPhoto = Boolean(it.image_url)
    const thumb = hasPhoto
      ? `<img class="dish-thumb" src="${escapeHtml(it.image_url)}" alt="" loading="lazy" decoding="async" />`
      : ''
    const clickable = hasPhoto ? ' dish-has-photo' : ''
    const attrs = hasPhoto
      ? ` class="${(star + clickable).trim()}" data-dish-id="${escapeHtml(it.id)}" role="button" tabindex="0"`
      : star
        ? ` class="${star.trim()}"`
        : ''
    return `<li${attrs}>${thumb}<div class="dish-body"><div class="dish-top"><strong>${badge}${escapeHtml(it.name)}</strong><b class="price">${price}</b></div>${desc}</div></li>`
  }

  /** Hero «Siempre»: estrellas de Colombia (tamales separados + fotos si hay image_url). */
  function fillHeroEstrellas(data) {
    const ul = document.querySelector('.hero-estrellas')
    if (!ul) return
    const colombia = (data.categories || []).find((c) => c && c.id === 'colombia')
    let stars = (colombia?.items || []).filter(
      (it) => it && it.star && !it.customProduct,
    )
    if (!stars.length) {
      stars = (data.categories || [])
        .flatMap((c) => c.items || [])
        .filter((it) => it && it.star && !it.customProduct)
    }
    // Preferir orden: valluno, tolimense, lechona, bandeja, resto
    const order = [
      'colombia-tamal-valluno',
      'colombia-tamal-tolimense',
      'colombia-lechona',
      'colombia-bandeja-paisa',
    ]
    stars = [...stars].sort((a, b) => {
      const ia = order.indexOf(a.id)
      const ib = order.indexOf(b.id)
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
    })
    if (!stars.length) return
    ul.classList.toggle('has-photos', stars.some((it) => it.image_url))
    ul.style.setProperty('--estrella-cols', String(Math.min(4, Math.max(2, stars.length))))
    ul.innerHTML = stars
      .map((it, i) => {
        const hasPhoto = Boolean(it.image_url)
        const photo = hasPhoto
          ? `<img class="estrella-photo" src="${escapeHtml(it.image_url)}" alt="${escapeHtml(it.name)}" loading="lazy" decoding="async" />`
          : ''
        const desc = it.desc
          ? `<span>${escapeHtml(it.desc)}</span>`
          : ''
        // Sin data-carta / #carta: el click abre el modal de foto (como en la carta), no hace scroll
        const cls = hasPhoto ? ' class="has-photo"' : ''
        const role = hasPhoto ? ' role="button" tabindex="0"' : ''
        return `<li style="--i:${i}">
          <a href="#"${cls}${role} data-dish-id="${escapeHtml(it.id)}">
            ${photo}
            <em>Siempre</em>
            <strong>${escapeHtml(it.name)}</strong>
            ${desc}
            <b>${money(it.price)}</b>
          </a>
        </li>`
      })
      .join('')
    ul.querySelectorAll('a[data-dish-id]').forEach((el) => {
      const open = (e) => {
        e.preventDefault()
        e.stopPropagation()
        const dishId = el.getAttribute('data-dish-id')
        const it = dishId ? dishById.get(dishId) : null
        if (it?.image_url) openDishModal(it)
      }
      el.addEventListener('click', open)
      el.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        open(e)
      })
    })
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

  function ensureDishModal() {
    let el = document.getElementById('dishPhotoModal')
    if (el) return el
    el = document.createElement('div')
    el.id = 'dishPhotoModal'
    el.className = 'dish-modal'
    el.hidden = true
    el.setAttribute('role', 'dialog')
    el.setAttribute('aria-modal', 'true')
    el.setAttribute('aria-labelledby', 'dishModalTitle')
    el.innerHTML = `
      <div class="dish-modal-backdrop" data-close="1"></div>
      <div class="dish-modal-card" role="document">
        <button type="button" class="dish-modal-close" data-close="1" aria-label="Cerrar">
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
        <div class="dish-modal-media">
          <img id="dishModalImg" alt="" />
        </div>
        <div class="dish-modal-body">
          <h3 id="dishModalTitle"></h3>
          <p id="dishModalDesc" class="dish-modal-desc" hidden></p>
          <p id="dishModalPrice" class="dish-modal-price"></p>
        </div>
      </div>`
    document.body.appendChild(el)
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) closeDishModal()
    })
    return el
  }

  function openDishModal(it, opts = {}) {
    if (!it?.image_url) return
    const photoOnly = Boolean(opts.photoOnly)
    const isMenu =
      Boolean(opts.menuSheet) ||
      String(it.id || '').startsWith('menu-dia') ||
      String(it.catId || '') === 'menus-dia'
    // En TV / landscape: pantalla dedicada = cartel completo sin barra blanca
    try {
      const tvLike =
        isMenu &&
        !photoOnly &&
        window.matchMedia('(orientation: landscape) and (min-width: 900px)').matches
      if (tvLike && !opts.forceModal) {
        window.location.href = 'menu-tv.html'
        return
      }
    } catch {}
    const modal = ensureDishModal()
    const img = document.getElementById('dishModalImg')
    const title = document.getElementById('dishModalTitle')
    const desc = document.getElementById('dishModalDesc')
    const price = document.getElementById('dishModalPrice')
    modal.classList.toggle('is-menu-sheet', isMenu)
    modal.classList.toggle('is-photo-only', photoOnly)
    if (img) {
      img.src = it.image_url
      img.alt = photoOnly ? 'Menú' : it.name || (isMenu ? 'Menú del día' : 'Plato')
      // Forzar layout tras cargar (TVs que miden mal el alto antes del decode)
      img.onload = () => {
        try {
          img.style.maxHeight = '100%'
        } catch {}
      }
    }
    if (title) {
      title.textContent = photoOnly ? '' : it.name || ''
      title.hidden = photoOnly
    }
    if (desc) {
      // En menú del día la foto es el contenido: no repetir descripción
      if (isMenu || photoOnly) {
        desc.textContent = ''
        desc.hidden = true
      } else {
        const text = String(it.desc || '').trim()
        desc.textContent = text
        desc.hidden = !text
      }
    }
    if (price) {
      if (photoOnly) {
        price.textContent = ''
        price.hidden = true
      } else {
        price.textContent = money(it.price)
        // En menú el precio ya está en el cartel; ocultar barra en landscape
        try {
          const hideBar =
            isMenu &&
            window.matchMedia('(orientation: landscape) and (min-width: 900px)').matches
          price.hidden = hideBar
          if (title) title.hidden = hideBar
        } catch {
          price.hidden = false
        }
      }
    }
    modal.hidden = false
    requestAnimationFrame(() => modal.classList.add('is-open'))
    document.body.classList.add('dish-modal-open')
  }

  function closeDishModal() {
    const modal = document.getElementById('dishPhotoModal')
    if (!modal || modal.hidden) return
    modal.classList.remove('is-open')
    modal.classList.remove('is-menu-sheet')
    modal.classList.remove('is-photo-only')
    document.body.classList.remove('dish-modal-open')
    window.setTimeout(() => {
      modal.hidden = true
      const img = document.getElementById('dishModalImg')
      if (img) img.removeAttribute('src')
      const title = document.getElementById('dishModalTitle')
      const price = document.getElementById('dishModalPrice')
      if (title) title.hidden = false
      if (price) price.hidden = false
    }, 220)
  }

  function bindDishClicks(root) {
    root?.addEventListener('click', (e) => {
      const li = e.target.closest('li.dish-has-photo[data-dish-id]')
      if (!li) return
      const id = li.getAttribute('data-dish-id')
      const it = dishById.get(id)
      if (it) openDishModal(it)
    })
    root?.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return
      const li = e.target.closest('li.dish-has-photo[data-dish-id]')
      if (!li) return
      e.preventDefault()
      const id = li.getAttribute('data-dish-id')
      const it = dishById.get(id)
      if (it) openDishModal(it)
    })
  }

  function indexDishes(data) {
    dishById = new Map()
    for (const cat of data.categories || []) {
      for (const it of cat.items || []) {
        if (it?.id) dishById.set(it.id, it)
      }
    }
  }

  function fillCarta(data) {
    const cats = data.categories || []
    const nav = document.getElementById('cartaNav')
    const grid = document.querySelector('.carta-grid')
    if (!nav || !grid) return

    indexDishes(data)
    ensureDishModal()

    const byId = Object.fromEntries(cats.map((c) => [c.id, c]))
    // Menús del día: solo en el hero (fotos), nunca en la carta para no repetir.
    const HIDDEN_PUBLIC = new Set(['menus-dia', 'menus-historico', 'extras'])
    // Colombia es el sello: siempre primero en la carta pública.
    let sections = (data.publicSections || []).filter(
      (id) => byId[id] && !HIDDEN_PUBLIC.has(id),
    )
    if (!sections.length) {
      sections = cats
        .map((c) => c.id)
        .filter((id) => id && !HIDDEN_PUBLIC.has(id))
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

    bindDishClicks(grid)
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
      ensureDishModal()
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeDishModal()
      })
      const data = await loadCartaData()
      if (!data) return
      indexDishes(data)
      fillMenuDia(data)
      fillHeroEstrellas(data)
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
