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

      // Calculate aspect ratios
      const imageAspectRatio = img.width / img.height
      const targetAspectRatio = maxWidth / maxHeight

      let drawWidth = maxWidth
      let drawHeight = maxHeight
      let drawX = 0
      let drawY = 0

      // Calculate dimensions to maintain aspect ratio
      if (imageAspectRatio > targetAspectRatio) {
        // Image is wider than target - fit to width
        drawHeight = maxWidth / imageAspectRatio
        drawY = (maxHeight - drawHeight) / 2
      } else {
        // Image is taller than target - fit to height
        drawWidth = maxHeight * imageAspectRatio
        drawX = (maxWidth - drawWidth) / 2
      }

      // Draw the image centered with proper aspect ratio
      ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight)

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

export async function cropImage(
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

      // Calculate aspect ratios
      const imageAspectRatio = img.width / img.height
      const targetAspectRatio = maxWidth / maxHeight

      let sourceX = 0
      let sourceY = 0
      let sourceWidth = img.width
      let sourceHeight = img.height

      // Determine crop area based on aspect ratio comparison
      if (imageAspectRatio > targetAspectRatio) {
        // Image is wider than target - crop width (center horizontally)
        sourceWidth = img.height * targetAspectRatio
        sourceX = (img.width - sourceWidth) / 2
      } else {
        // Image is taller than target - crop height (center vertically)
        sourceHeight = img.width / targetAspectRatio
        sourceY = (img.height - sourceHeight) / 2
      }

      // Draw the cropped image onto the canvas
      ctx.drawImage(
        img,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        maxWidth,
        maxHeight
      )

      canvas.toBlob((blob) => {
        if (blob) {
          const croppedFile = new File([blob], file.name, { type: 'image/png' })
          resolve(croppedFile)
        } else {
          reject(new Error('Failed to create blob from canvas'))
        }
      }, 'image/png')
    }
    img.onerror = (error) => reject(error)
    img.src = URL.createObjectURL(file)
  })
}

export async function isImageBlank(file: File): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        URL.revokeObjectURL(objectUrl)
        reject(new Error('Unable to get canvas context'))
        return
      }

      ctx.drawImage(img, 0, 0)

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data

      // Count pixels that are nearly white or transparent
      let nonBlankPixels = 0
      const totalPixels = imageData.length / 4

      for (let i = 0; i < imageData.length; i += 4) {
        const r = imageData[i]
        const g = imageData[i + 1]
        const b = imageData[i + 2]
        const a = imageData[i + 3]

        // Consider a pixel non-blank if it's not very close to white or transparent
        if (r < 240 || g < 240 || b < 240) {
          if (a > 10) {
            // Only count if pixel isn't transparent
            nonBlankPixels++
          }
        }
      }

      // Consider image blank if less than 0.1% of pixels are non-blank
      const isBlank = nonBlankPixels / totalPixels < 0.001

      URL.revokeObjectURL(objectUrl)
      resolve(isBlank)
    }

    img.onerror = (error) => {
      URL.revokeObjectURL(objectUrl)
      reject(error)
    }

    img.src = objectUrl
  })
}

export async function cropImageWithCoordinates(
  file: File,
  cropX: number,
  cropY: number,
  cropSize: number
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

      // Set canvas size to crop size (square)
      canvas.width = cropSize
      canvas.height = cropSize

      // Clear the canvas to ensure transparency
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Draw the cropped image onto the canvas
      ctx.drawImage(
        img,
        cropX,
        cropY,
        cropSize,
        cropSize,
        0,
        0,
        cropSize,
        cropSize
      )

      canvas.toBlob((blob) => {
        if (blob) {
          const croppedFile = new File([blob], file.name, { type: 'image/png' })
          resolve(croppedFile)
        } else {
          reject(new Error('Failed to create blob from canvas'))
        }
      }, 'image/png')
    }
    img.onerror = (error) => reject(error)
    img.src = URL.createObjectURL(file)
  })
}

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024 // 4 MB (Vercel limit is 4.5 MB, leave headroom)
const MAX_DIMENSION = 2048

/**
 * Compress an image File/Blob so it stays under Vercel's 4.5 MB payload limit.
 * Downscales to MAX_DIMENSION and converts to JPEG at decreasing quality until
 * the result fits. Non-image blobs are returned unchanged.
 */
export async function compressImageForUpload(
  blob: Blob | File
): Promise<Blob | File> {
  // Only compress image types
  if (!blob.type.startsWith('image/')) return blob
  // Already small enough
  if (blob.size <= MAX_UPLOAD_BYTES) return blob

  return new Promise((resolve, reject) => {
    const img = new window.Image()
    const objectUrl = URL.createObjectURL(blob)

    img.onload = async () => {
      URL.revokeObjectURL(objectUrl)

      // Downscale if either dimension exceeds MAX_DIMENSION
      let { width, height } = img
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const scale = MAX_DIMENSION / Math.max(width, height)
        width = Math.round(width * scale)
        height = Math.round(height * scale)
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Unable to get canvas context'))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)

      // Try decreasing JPEG quality until under the limit
      const qualities = [0.85, 0.7, 0.5, 0.3]
      for (const q of qualities) {
        const result = await new Promise<Blob | null>((res) =>
          canvas.toBlob((b) => res(b), 'image/jpeg', q)
        )
        if (result && result.size <= MAX_UPLOAD_BYTES) {
          const name = blob instanceof File ? blob.name.replace(/\.\w+$/, '.jpg') : 'image.jpg'
          resolve(new File([result], name, { type: 'image/jpeg' }))
          return
        }
      }

      // Last resort: further downscale at lowest quality
      const smallerScale = 0.5
      canvas.width = Math.round(width * smallerScale)
      canvas.height = Math.round(height * smallerScale)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (result) => {
          if (result) {
            const name = blob instanceof File ? blob.name.replace(/\.\w+$/, '.jpg') : 'image.jpg'
            resolve(new File([result], name, { type: 'image/jpeg' }))
          } else {
            reject(new Error('Failed to compress image'))
          }
        },
        'image/jpeg',
        0.3
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      // If we can't decode it as an image, just return the original
      resolve(blob)
    }

    img.src = objectUrl
  })
}
