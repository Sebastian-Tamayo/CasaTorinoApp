/**
 * Compat TPV: expone window.TPV_CATALOG desde data/carta.json.
 * Debe cargarse antes del script inline de tpv.html (defer + await boot).
 */
window.TPV_CATALOG = window.TPV_CATALOG || []
window.TPV_CARTA_META = null
window.TPV_MENU_FORCE_ALL = false

window.CasaTorinoLoadTpvCatalog = async function CasaTorinoLoadTpvCatalog() {
  const api = window.CasaTorinoCarta
  if (!api) throw new Error('carta.js no cargado')
  const data = await api.loadCarta()
  window.TPV_CARTA_META = data
  const cats = Array.isArray(data.categories) ? data.categories : []
  window.TPV_MENU_DAY_INFO = api.isWeekendMenuDay(data)
  window.TPV_CATALOG = api.applyMenuSchedule(cats, {
    forceAll: Boolean(window.TPV_MENU_FORCE_ALL),
    meta: data,
  })
  return window.TPV_CATALOG
}
