export async function fitImage(
  file: File,
  maxWidth: number,
  maxHeight: number
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        reject(new Error('Unable to get canvas context'))
        return
      }

      let newWidth = img.width
      let newHeight = img.height

      // Calculate the scaling factor to fit within maxWidth and maxHeight
      const scale = Math.min(maxWidth / img.width, maxHeight / img.height)

      // Only scale down, don't enlarge
      if (scale < 1) {
        newWidth = img.width * scale
        newHeight = img.height * scale
      }

      // Set canvas size
      canvas.width = maxWidth === maxHeight ? maxWidth : newWidth
      canvas.height = maxWidth === maxHeight ? maxHeight : newHeight

      // Clear the canvas to ensure transparency
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // If it's a square output, center the image
      const x = maxWidth === maxHeight ? (maxWidth - newWidth) / 2 : 0
      const y = maxWidth === maxHeight ? (maxHeight - newHeight) / 2 : 0

      ctx.drawImage(img, x, y, newWidth, newHeight)

      canvas.toBlob((blob) => {
        if (blob) {
          const fittedFile = new File([blob], file.name, { type: 'image/png' })
          resolve(fittedFile)
        } else {
          reject(new Error('Failed to create blob from canvas'))
        }
      }, 'image/png')
    }
    img.onerror = (error) => reject(error)
    img.src = URL.createObjectURL(file)
  })
}
