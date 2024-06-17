import toast from 'react-hot-toast'

export default function isTextInavlid(text: string) {
  if (!text || text === '' || typeof text !== 'string') {
    return false
  }

  if (/\p{Extended_Pictographic}/u.test(text)) {
    toast.error('Emojis are not allowed.', { duration: 10000 })
    return true
  }

  //check if text includes a single quote
  if (text?.includes("'")) {
    toast.error('Single quotes are not allowed.', {
      duration: 10000,
    })
    return true
  }

  return false
}
