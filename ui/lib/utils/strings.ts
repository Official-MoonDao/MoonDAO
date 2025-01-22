export const bufferToHex = (x: any) => `0x${x.toString('hex')}`

export const removeMarkdownFormatting = (text: string) => {
  return text.replace(/[#_*~`]/g, '')
}

export const addHttpsIfMissing = (url: string) => {
  if (!url.startsWith('https://')) {
    return `https://${url}`
  }
  return url
}
