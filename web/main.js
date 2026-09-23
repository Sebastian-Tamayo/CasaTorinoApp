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

document.querySelectorAll('[data-carta]').forEach((el) => {
  // Las estrellas del hero las maneja carta-public.js (modal foto, sin scroll)
  if (el.closest('.hero-estrellas')) return
  el.addEventListener('click', (e) => {
    const id = el.getAttribute('data-carta')
    if (!id) return
    e.preventDefault()
    const liveNav = document.getElementById('cartaNav')
    const btn = liveNav?.querySelector(`button[data-target="${id}"]`)
    if (btn) btn.click()
    else {
      showCarta(id)
      document.getElementById('carta')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  })
})
