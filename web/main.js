const navToggle = document.getElementById('navToggle')
const nav = document.getElementById('nav')
const year = document.getElementById('year')

if (year) year.textContent = String(new Date().getFullYear())

navToggle?.addEventListener('click', () => {
  nav?.classList.toggle('open')
})

nav?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => nav.classList.remove('open'))
})

const cartaNav = document.getElementById('cartaNav')
const cartaBlocks = Array.from(document.querySelectorAll('.carta-block'))

function showCarta(targetId) {
  cartaBlocks.forEach((block) => {
    block.classList.toggle('is-active', block.id === targetId)
  })
  cartaNav?.querySelectorAll('button').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-target') === targetId)
  })
}

cartaNav?.querySelectorAll('button').forEach((btn) => {
  btn.addEventListener('click', () => {
    const id = btn.getAttribute('data-target')
    if (!id) return
    showCarta(id)
    document.getElementById('carta')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
})

const initial =
  cartaNav?.querySelector('button.active')?.getAttribute('data-target') ||
  cartaBlocks[0]?.id

if (initial) showCarta(initial)

/* Post Día del Amor y la Amistad — activo hasta sáb 19 sep 2026 23:55 Madrid (CEST) */
;(function initEventoAmorAmistad() {
  const END_MS = Date.parse('2026-09-19T23:55:00+02:00')
  const root = document.getElementById('evento-amor-amistad')
  if (!root) return

  function sync() {
    const active = Date.now() < END_MS
    root.hidden = !active
    document.body.classList.toggle('has-destacado-amor', active)
    return active
  }

  sync()
  setInterval(sync, 30000)
})()
