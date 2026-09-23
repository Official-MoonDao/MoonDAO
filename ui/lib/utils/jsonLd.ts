/**
 * Serialize a JSON-LD payload for embedding in a `<script type="application/ld+json">`
 * tag. Author-controlled strings (job titles, listing descriptions) would
 * otherwise be able to close the surrounding script tag and inject markup, so
 * escape the characters that can break out — plus the unicode line separators
 * that are valid JSON but invalid JavaScript.
 */
export function serializeJsonLd(jsonLd: Record<string, any>): string {
  return JSON.stringify(jsonLd)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}
