/* Renderiza carta pública desde data/carta.json (misma fuente que el TPV). */
(() => {
  const money = (n) =>
    Number(n).toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + '\u00a0€'

  function fillMenuDia(meta) {
    const ul = document.querySelector('.menu-precios')
    if (!ul || !meta?.menuDay) return
    const w = meta.menuDay.weekday
    const e = meta.menuDay.weekend
    ul.innerHTML = `
      <li>
        <span class="mp-label">Entre semana</span>
        <span class="mp-detail">Español <em>${w.es}\u00a0€</em> · Colombiano <em>${w.co}\u00a0€</em></span>
      </li>
      <li>
        <span class="mp-label">Fin de semana</span>
        <span class="mp-detail">Español <em>${e.es}\u00a0€</em> · Colombiano <em>${e.co}\u00a0€</em></span>
      </li>`
  }

  function fillCarta(data) {
    const sections = data.publicSections || []
    const cats = data.categories || []
    const nav = document.getElementById('cartaNav')
    const grid = document.querySelector('.carta-grid')
    if (!nav || !grid) return

    const byId = Object.fromEntries(cats.map((c) => [c.id, c]))
    nav.innerHTML = sections
      .filter((id) => byId[id])
      .map((id, i) => {
        const c = byId[id]
        return `<button type="button" data-target="${id}" class="${i === 0 ? 'active' : ''}">${c.name}</button>`
      })
      .join('')

    grid.innerHTML = sections
      .filter((id) => byId[id])
      .map((id, i) => {
        const c = byId[id]
        const featured = id === 'colombia' ? ' featured' : ''
        const items = (c.items || [])
          .filter((it) => !it.customProduct)
          .map((it) => {
            const price = money(it.price)
            const desc = it.desc ? `<span>${it.desc}</span>` : ''
            return `<li><div class="dish-top"><strong>${it.name}</strong><b class="price">${price}</b></div>${desc}</li>`
          })
          .join('')
        return `<article class="carta-block${featured}${i === 0 ? ' is-active' : ''}" id="${id}">
          <h3>${c.name}</h3>
          <div class="carta-scroll"><ul>${items}</ul></div>
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

  async function boot() {
    try {
      const r = await fetch('data/carta.json', { cache: 'no-store' })
      if (!r.ok) return
      const data = await r.json()
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
