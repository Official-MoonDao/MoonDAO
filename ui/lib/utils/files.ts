export function renameFile(file: File, newName: string) {
  return new File([file], newName, {
    type: file.type,
    lastModified: file.lastModified,
  })
}

export interface SerializedFile {
  name: string
  type: string
  data: string
}

export function fileToBase64(file: File): Promise<SerializedFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve({
        name: file.name,
        type: file.type,
        data: result,
      })
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

export function base64ToFile(serialized: SerializedFile): File {
  const byteString = atob(serialized.data.split(',')[1])
  const mimeType = serialized.type || 'image/png'
  const ab = new ArrayBuffer(byteString.length)
  const ia = new Uint8Array(ab)
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i)
  }
  const blob = new Blob([ab], { type: mimeType })
  return new File([blob], serialized.name, { type: mimeType })
}

export function isSerializedFile(obj: any): obj is SerializedFile {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.name === 'string' &&
    typeof obj.data === 'string' &&
    obj.data.startsWith('data:')
  )
}
