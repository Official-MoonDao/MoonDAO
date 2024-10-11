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

      // Set canvas size to maxWidth and maxHeight
      canvas.width = maxWidth
      canvas.height = maxHeight

      // Clear the canvas to ensure transparency
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Stretch the image to fit the canvas
      ctx.drawImage(img, 0, 0, maxWidth, maxHeight)

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
