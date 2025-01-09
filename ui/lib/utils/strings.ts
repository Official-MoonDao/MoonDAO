export const bufferToHex = (x: any) => `0x${x.toString('hex')}`

export const removeMarkdownFormatting = (text: string) => {
  return text.replace(/[#_*~`]/g, '')
}
