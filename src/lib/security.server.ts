/**
 * Security headers applied to all SSR responses.
 * Defense-in-depth layer; CSP is set per-route in headers() callbacks.
 */
export function applySecurityHeaders(headers: Headers): void {
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('X-Frame-Options', 'DENY')
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  if (process.env.NODE_ENV === 'production') {
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
}

export function cspFor(_route: string): string {
  const base = [
    `default-src 'self'`,
    `script-src 'self' 'unsafe-inline'`, // TanStack Start may need inline scripts
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: https:`,
    `font-src 'self' data:`,
    `connect-src 'self'`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
  ]
  // Keep embedded content locked down for the internal knowledge base.
  return base.join('; ')
}
