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

/* Día del Amor y la Amistad — activo hasta sáb 19 sep 2026 23:55 Madrid (CEST) */
;(function initEventoAmorAmistad() {
  const END_MS = Date.parse('2026-09-19T23:55:00+02:00')
  const root = document.getElementById('eventoAmorAmistad')
  if (!root) return

  const video = document.getElementById('eventoAmorVideo')
  const poster = root.querySelector('.evento-amor__poster')

  function closeEvento() {
    root.hidden = true
    document.body.classList.remove('evento-amor-open')
    if (video) {
      try { video.pause() } catch (_) {}
    }
  }

  function openEvento() {
    root.hidden = false
    document.body.classList.add('evento-amor-open')
    if (video) {
      const tryPlay = () => {
        const p = video.play()
        if (p && typeof p.then === 'function') {
          p.then(() => {
            if (poster) poster.hidden = true
            video.classList.add('is-playing')
          }).catch(() => {
            /* sin autoplay o sin mp4: se queda el cartel */
          })
        }
      }
      video.addEventListener('loadeddata', tryPlay, { once: true })
      if (video.readyState >= 2) tryPlay()
    }
  }

  root.querySelectorAll('[data-evento-close]').forEach((el) => {
    el.addEventListener('click', closeEvento)
  })

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !root.hidden) closeEvento()
  })

  function sync() {
    if (Date.now() >= END_MS) {
      closeEvento()
      return false
    }
    return true
  }

  if (sync()) openEvento()
  setInterval(sync, 30000)
})()
