export function isValidYouTubeUrl(url: string): boolean {
  if (!url || url.trim().length === 0) return false

  const youtubeRegex =
    /^https?:\/\/(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/)|youtu\.be\/)[\w-]+(\S+)?$/
  return youtubeRegex.test(url.trim())
}
