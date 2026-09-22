/**
 * Cabeceras de seguridad HTTP (baseline 2026) para APIs serverless.
 * No impone CSP agresiva (rompería CDN Font Awesome / Google Fonts / QZ).
 */
function applySecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()',
  )
  res.setHeader('X-DNS-Prefetch-Control', 'off')
  // Vercel ya fuerza HTTPS; HSTS refuerza el cliente
  res.setHeader(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains',
  )
  res.setHeader('Cache-Control', 'no-store')
}

module.exports = { applySecurityHeaders }
