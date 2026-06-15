export const bufferToHex = (x: any) => `0x${x.toString('hex')}`

export const removeMarkdownFormatting = (text: string) => {
  return text.replace(/[#_*~`]/g, '')
}

export const addHttpsIfMissing = (url: string) => {
  if (!url) return url
  // Leave any URL that already declares a scheme (https://, http://, ipfs://,
  // etc.) untouched — only checking for `https://` previously turned
  // `http://x.com` into `https://http://x.com`.
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
    return url
  }
  return `https://${url}`
}

export const bytesOfString = (str: string) => {
  return new TextEncoder().encode(str).length
}

// Function to return {tokenSymbol} and/or 'tokens', translated and (possibly) capitalized
export const tokenSymbolText = ({
  tokenSymbol,
  capitalize,
  plural,
  includeTokenWord,
}: {
  tokenSymbol?: string
  capitalize?: boolean
  plural?: boolean
  includeTokenWord?: boolean
}) => {
  const defaultTokenTextSingular = capitalize ? 'Token' : 'token'
  const defaultTokenTextPlural = capitalize ? 'Tokens' : 'tokens'
  const defaultTokenText = plural
    ? defaultTokenTextPlural
    : defaultTokenTextSingular

  if (includeTokenWord) {
    return tokenSymbol ? `${tokenSymbol} ${defaultTokenText}` : defaultTokenText
  }

  return tokenSymbol ?? defaultTokenText
}
