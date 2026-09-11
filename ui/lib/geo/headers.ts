export type GeoHeaderRequest = {
  headers: Record<string, string | string[] | undefined>
}

function header(req: GeoHeaderRequest, name: string): string {
  const raw = req.headers[name]
  const value = Array.isArray(raw) ? raw[0] : raw
  return value?.trim() ?? ''
}

export function getCountryFromHeaders(req: GeoHeaderRequest): string | null {
  const vercelCountry = header(req, 'x-vercel-ip-country')
  if (vercelCountry) return vercelCountry.toUpperCase()
  const cfCountry = header(req, 'cf-ipcountry')
  if (cfCountry) return cfCountry.toUpperCase()
  return null
}

export function getStateFromHeaders(req: GeoHeaderRequest): string | null {
  const vercelRegion = header(req, 'x-vercel-ip-country-region')
  const vercelCountry = header(req, 'x-vercel-ip-country')
  if (vercelCountry === 'US' && vercelRegion) return vercelRegion.toUpperCase()

  const cfRegion = header(req, 'cf-region-code')
  const cfCountry = header(req, 'cf-ipcountry')
  if (cfCountry === 'US' && cfRegion) return cfRegion.toUpperCase()

  return null
}

export function getRegionFromHeaders(req: GeoHeaderRequest): string | null {
  const vercel = header(req, 'x-vercel-ip-country-region')
  if (vercel) return vercel.toUpperCase()
  const cf = header(req, 'cf-region-code')
  if (cf) return cf.toUpperCase()
  return getStateFromHeaders(req)
}
