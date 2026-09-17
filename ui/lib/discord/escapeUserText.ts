/** Escape user- or atlas-supplied text before it reaches any Discord sink. */
export function escapeDiscordUserText(input: string): string {
  return String(input)
    .replace(/@everyone/gi, '@\u200beveryone')
    .replace(/@here/gi, '@\u200bhere')
    .replace(/\\/g, '\\\\')
    .replace(/(\*|_|`|~|\||>)/g, '\\$1')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}
