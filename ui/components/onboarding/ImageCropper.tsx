import { useState, useRef, useEffect } from 'react'
import { cropImageWithCoordinates } from '@/lib/utils/images'

interface ImageCropperProps {
  image: File
  onCrop: (croppedFile: File) => void
  onCancel: () => void
}

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | null

export default function ImageCropper({
  image,
  onCrop,
  onCancel,
}: ImageCropperProps) {
  const [cropArea, setCropArea] = useState({
    x: 0,
    y: 0,
    size: 200,
  })
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle>(null)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
  const imageRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      setImageSize({ width: img.width, height: img.height })
      // Initialize crop area to center
      const minDimension = Math.min(img.width, img.height)
      const initialSize = Math.min(minDimension, 200)
      setCropArea({
        x: (img.width - initialSize) / 2,
        y: (img.height - initialSize) / 2,
        size: initialSize,
      })
    }
    img.src = URL.createObjectURL(image)
  }, [image])

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault() // Prevent text selection
    const target = e.target as HTMLElement
    if (target.classList.contains('resize-handle')) {
      setIsResizing(true)
      setResizeHandle(target.dataset.handle as ResizeHandle)
    } else if (target.classList.contains('crop-area')) {
      setIsDragging(true)
    }
    setDragStart({ x: e.clientX, y: e.clientY })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    e.preventDefault() // Prevent text selection
    if (!containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const scaleX = imageSize.width / rect.width
    const scaleY = imageSize.height / rect.height

    const deltaX = (e.clientX - dragStart.x) * scaleX
    const deltaY = (e.clientY - dragStart.y) * scaleY

    if (isResizing && resizeHandle) {
      handleResize(deltaX, deltaY)
    } else if (isDragging) {
      setCropArea((prev) => ({
        ...prev,
        x: Math.max(0, Math.min(imageSize.width - prev.size, prev.x + deltaX)),
        y: Math.max(0, Math.min(imageSize.height - prev.size, prev.y + deltaY)),
      }))
    }

    setDragStart({ x: e.clientX, y: e.clientY })
  }

  const handleResize = (deltaX: number, deltaY: number) => {
    setCropArea((prev) => {
      let newX = prev.x
      let newY = prev.y
      let newSize = prev.size

      switch (resizeHandle) {
        case 'nw':
          // Top-left: dragging away from corner increases size
          const nwDelta = -(deltaX + deltaY) / 2 // Average of both deltas, negative because we're moving away from top-left
          newSize = Math.max(
            50,
            Math.min(
              prev.size + nwDelta,
              Math.min(prev.x + prev.size, prev.y + prev.size)
            )
          )
          newX = prev.x + (prev.size - newSize)
          newY = prev.y + (prev.size - newSize)
          break
        case 'ne':
          // Top-right: dragging away from corner increases size
          const neDelta = (deltaX - deltaY) / 2 // X increases, Y decreases when moving away from top-right
          newSize = Math.max(
            50,
            Math.min(
              prev.size + neDelta,
              Math.min(imageSize.width - prev.x, prev.y + prev.size)
            )
          )
          newY = prev.y + (prev.size - newSize)
          break
        case 'sw':
          // Bottom-left: dragging away from corner increases size
          const swDelta = (-deltaX + deltaY) / 2 // X decreases, Y increases when moving away from bottom-left
          newSize = Math.max(
            50,
            Math.min(
              prev.size + swDelta,
              Math.min(prev.x + prev.size, imageSize.height - prev.y)
            )
          )
          newX = prev.x + (prev.size - newSize)
          break
        case 'se':
          // Bottom-right: dragging away from corner increases size
          const seDelta = (deltaX + deltaY) / 2 // Both X and Y increase when moving away from bottom-right
          newSize = Math.max(
            50,
            Math.min(
              prev.size + seDelta,
              Math.min(imageSize.width - prev.x, imageSize.height - prev.y)
            )
          )
          break
        case 'n':
          // Top edge: only resize if we can grow upward or are shrinking
          if (prev.y > 0 || deltaY < 0) {
            newSize = Math.max(
              50,
              Math.min(prev.size - deltaY, prev.y + prev.size)
            )
            newY = prev.y + (prev.size - newSize)
          } else {
            // If we can't resize, don't change anything
            return prev
          }
          break
        case 's':
          // Bottom edge: only resize if we can grow downward or are shrinking
          if (prev.y + prev.size < imageSize.height || deltaY > 0) {
            newSize = Math.max(
              50,
              Math.min(prev.size + deltaY, imageSize.height - prev.y)
            )
          } else {
            // If we can't resize, don't change anything
            return prev
          }
          break
        case 'e':
          // Right edge: only resize if we can grow rightward or are shrinking
          if (prev.x + prev.size < imageSize.width || deltaX > 0) {
            newSize = Math.max(
              50,
              Math.min(prev.size + deltaX, imageSize.width - prev.x)
            )
          } else {
            // If we can't resize, don't change anything
            return prev
          }
          break
        case 'w':
          // Left edge: only resize if we can grow leftward or are shrinking
          if (prev.x > 0 || deltaX < 0) {
            newSize = Math.max(
              50,
              Math.min(prev.size - deltaX, prev.x + prev.size)
            )
            newX = prev.x + (prev.size - newSize)
          } else {
            // If we can't resize, don't change anything
            return prev
          }
          break
      }

      // Ensure crop area stays within image bounds
      newX = Math.max(0, Math.min(imageSize.width - newSize, newX))
      newY = Math.max(0, Math.min(imageSize.height - newSize, newY))

      // Ensure size doesn't exceed available space
      newSize = Math.min(
        newSize,
        imageSize.width - newX,
        imageSize.height - newY
      )

      return { x: newX, y: newY, size: newSize }
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    setIsResizing(false)
    setResizeHandle(null)
  }

  const handleCrop = async () => {
    try {
      const croppedFile = await cropImageWithCoordinates(
        image,
        cropArea.x,
        cropArea.y,
        cropArea.size
      )
      onCrop(croppedFile)
    } catch (error) {
      console.error('Error cropping image:', error)
    }
  }

  const scale = Math.min(400 / imageSize.width, 400 / imageSize.height, 1)

  return (
    <div className="flex flex-col">
      <h3 className="text-xl font-bold mb-4 text-white">Crop Your Image</h3>

      <div className="mb-4">
        <p className="text-sm text-white/60 mb-2">
          Drag the crop area to move it, or drag the handles to resize
        </p>
      </div>

      <div
        ref={containerRef}
        className="relative border-2 border-white/20 rounded-xl mx-auto mb-4 overflow-hidden select-none"
        style={{
          width: imageSize.width * scale,
          height: imageSize.height * scale,
        }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img
          ref={imageRef}
          src={URL.createObjectURL(image)}
          alt="Crop preview"
          className="w-full h-full object-contain select-none pointer-events-none"
          draggable={false}
        />

        {/* Crop overlay */}
        <div
          className="crop-area absolute border-2 border-blue-400 bg-blue-400/20 cursor-move rounded-lg select-none"
          style={{
            left: cropArea.x * scale,
            top: cropArea.y * scale,
            width: cropArea.size * scale,
            height: cropArea.size * scale,
          }}
          onMouseDown={handleMouseDown}
        >
          {/* Corner handles */}
          <div
            className="resize-handle absolute w-3 h-3 bg-blue-400 border border-white rounded-full cursor-nw-resize select-none"
            data-handle="nw"
            style={{ top: -6, left: -6 }}
            onMouseDown={handleMouseDown}
          />
          <div
            className="resize-handle absolute w-3 h-3 bg-blue-400 border border-white rounded-full cursor-ne-resize select-none"
            data-handle="ne"
            style={{ top: -6, right: -6 }}
            onMouseDown={handleMouseDown}
          />
          <div
            className="resize-handle absolute w-3 h-3 bg-blue-400 border border-white rounded-full cursor-sw-resize select-none"
            data-handle="sw"
            style={{ bottom: -6, left: -6 }}
            onMouseDown={handleMouseDown}
          />
          <div
            className="resize-handle absolute w-3 h-3 bg-blue-400 border border-white rounded-full cursor-se-resize select-none"
            data-handle="se"
            style={{ bottom: -6, right: -6 }}
            onMouseDown={handleMouseDown}
          />

          {/* Edge handles */}
          <div
            className="resize-handle absolute w-3 h-3 bg-blue-400 border border-white rounded-full cursor-n-resize select-none"
            data-handle="n"
            style={{ top: -6, left: '50%', transform: 'translateX(-50%)' }}
            onMouseDown={handleMouseDown}
          />
          <div
            className="resize-handle absolute w-3 h-3 bg-blue-400 border border-white rounded-full cursor-s-resize select-none"
            data-handle="s"
            style={{ bottom: -6, left: '50%', transform: 'translateX(-50%)' }}
            onMouseDown={handleMouseDown}
          />
          <div
            className="resize-handle absolute w-3 h-3 bg-blue-400 border border-white rounded-full cursor-e-resize select-none"
            data-handle="e"
            style={{ right: -6, top: '50%', transform: 'translateY(-50%)' }}
            onMouseDown={handleMouseDown}
          />
          <div
            className="resize-handle absolute w-3 h-3 bg-blue-400 border border-white rounded-full cursor-w-resize select-none"
            data-handle="w"
            style={{ left: -6, top: '50%', transform: 'translateY(-50%)' }}
            onMouseDown={handleMouseDown}
          />
        </div>

        {/* Dark overlay */}
        <div className="absolute inset-0 pointer-events-none select-none">
          <div
            className="absolute bg-black/50 select-none"
            style={{
              left: 0,
              top: 0,
              width: cropArea.x * scale,
              height: imageSize.height * scale,
            }}
          />
          <div
            className="absolute bg-black/50 select-none"
            style={{
              left: (cropArea.x + cropArea.size) * scale,
              top: 0,
              width: (imageSize.width - cropArea.x - cropArea.size) * scale,
              height: imageSize.height * scale,
            }}
          />
          <div
            className="absolute bg-black/50 select-none"
            style={{
              left: cropArea.x * scale,
              top: 0,
              width: cropArea.size * scale,
              height: cropArea.y * scale,
            }}
          />
          <div
            className="absolute bg-black/50 select-none"
            style={{
              left: cropArea.x * scale,
              top: (cropArea.y + cropArea.size) * scale,
              width: cropArea.size * scale,
              height: (imageSize.height - cropArea.y - cropArea.size) * scale,
            }}
          />
        </div>
      </div>

      <div className="flex gap-4 justify-end">
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg hover:bg-white/20 text-white transition-colors select-none"
        >
          Cancel
        </button>
        <button
          onClick={handleCrop}
          className="px-4 py-2 bg-blue-500/80 backdrop-blur-sm border border-blue-400/50 rounded-lg hover:bg-blue-500 text-white transition-colors select-none"
        >
          Crop Image
        </button>
      </div>
    </div>
  )
}
