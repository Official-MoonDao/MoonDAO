import Image from 'next/image'
import { useEffect, useState, useRef, useCallback } from 'react'
import useImageGenerator from '@/lib/image-generator/useImageGenerator'
import { cropImageWithCoordinates } from '@/lib/utils/images'
import FileInput from '../layout/FileInput'
import IPFSRenderer from '../layout/IPFSRenderer'

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | null

export function ImageGenerator({
  currImage,
  image,
  setImage,
  inputImage,
  setInputImage,
  nextStage,
  generateInBG,
  onGenerationStateChange, // Add this prop
}: any) {
  const [originalInputImage, setOriginalInputImage] = useState<File | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [croppedImage, setCroppedImage] = useState<File | null>(null)
  const [isReCropping, setIsReCropping] = useState(false)
  const [cropArea, setCropArea] = useState({
    x: 0,
    y: 0,
    size: 200,
  })

  const {
    generateImage,
    isLoading: generating,
    error: generateError,
  } = useImageGenerator('/api/image-gen/citizen-image', inputImage, setImage)

  // Store original image when first uploaded
  useEffect(() => {
    if (inputImage) {
      setOriginalInputImage(inputImage)
    }
  }, [inputImage])

  // Track generation state and notify parent
  useEffect(() => {
    if (onGenerationStateChange) {
      onGenerationStateChange(isGenerating || generating)
    }
  }, [isGenerating, generating, onGenerationStateChange])

  const handleGenerateImage = useCallback(async () => {
    if (!inputImage) return

    setIsGenerating(true)
    if (onGenerationStateChange) {
      onGenerationStateChange(true)
    }

    try {
      // First crop the image
      const croppedFile = await cropImageWithCoordinates(
        inputImage,
        cropArea.x,
        cropArea.y,
        cropArea.size
      )

      // Store the cropped image for fallback
      setCroppedImage(croppedFile)

      setImage(null) // Clear any existing generated image
      setShowError(false)

      // Generate the AI image using the cropped version (pass directly to avoid mutating inputImage)
      await generateImage(croppedFile)
    } catch (error) {
      console.error('Error cropping or generating image:', error)
      setIsGenerating(false)
      if (onGenerationStateChange) {
        onGenerationStateChange(false)
      }
      // Notify parent that generation failed
    }
  }, [
    inputImage,
    cropArea.x,
    cropArea.y,
    cropArea.size,
    setImage,
    generateImage,
    onGenerationStateChange,
  ])

  // When generation completes (success or failure), update image and reset local generating
  useEffect(() => {
    if (!generating) {
      if (generateError && croppedImage) {
        setImage(croppedImage)
      } else if (!generateError && image) {
        // AI generation succeeded — mark it
        setHasGeneratedImage(true)
      }
      setIsGenerating(false)
    }
  }, [generating, generateError, croppedImage, setImage, image])

  const [hasGeneratedImage, setHasGeneratedImage] = useState(false)
  const [showError, setShowError] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle>(null)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
  const [displayedImageSize, setDisplayedImageSize] = useState({
    width: 0,
    height: 0,
    offsetX: 0,
    offsetY: 0,
  })
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const animationFrameRef = useRef<number>()
  const [forceRerender, setForceRerender] = useState(0)
  const [isCroppingMode, setIsCroppingMode] = useState(true)

  // Manage object URLs via state so they survive re-renders and are cleaned up properly
  const [inputImageUrl, setInputImageUrl] = useState<string | null>(null)
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null)

  useEffect(() => {
    if (inputImage) {
      const url = URL.createObjectURL(inputImage)
      setInputImageUrl(url)
      return () => URL.revokeObjectURL(url)
    } else {
      setInputImageUrl(null)
    }
  }, [inputImage])

  useEffect(() => {
    if (image) {
      const url = URL.createObjectURL(image)
      setGeneratedImageUrl(url)
      return () => URL.revokeObjectURL(url)
    } else {
      setGeneratedImageUrl(null)
    }
  }, [image])

  // Calculate displayed image dimensions and position
  const calculateDisplayedImageSize = useCallback(() => {
    if (!containerRef.current || !imageSize.width || !imageSize.height) return

    const container = containerRef.current
    const containerWidth = container.offsetWidth
    const containerHeight = container.offsetHeight

    // Calculate scale to fit image in container with object-fit: contain
    const scaleX = containerWidth / imageSize.width
    const scaleY = containerHeight / imageSize.height
    const scale = Math.min(scaleX, scaleY)

    const displayedWidth = imageSize.width * scale
    const displayedHeight = imageSize.height * scale

    // Calculate offset to center the image
    const offsetX = (containerWidth - displayedWidth) / 2
    const offsetY = (containerHeight - displayedHeight) / 2

    setDisplayedImageSize({
      width: displayedWidth,
      height: displayedHeight,
      offsetX,
      offsetY,
    })
  }, [imageSize.width, imageSize.height])

  // Clear error when new input image is uploaded
  useEffect(() => {
    if (inputImage) {
      setShowError(false)
      // Initialize crop area when image is uploaded
      const imgElement = new window.Image()
      imgElement.onload = () => {
        setImageSize({ width: imgElement.width, height: imgElement.height })

        // Initialize crop area as largest possible square (full width or height)
        const minDimension = Math.min(imgElement.width, imgElement.height)

        setCropArea({
          x: (imgElement.width - minDimension) / 2,
          y: (imgElement.height - minDimension) / 2,
          size: minDimension,
        })

        // Calculate displayed image size after a short delay to ensure container is rendered
        setTimeout(calculateDisplayedImageSize, 100)
      }
      imgElement.src = URL.createObjectURL(inputImage)
    }
  }, [inputImage, calculateDisplayedImageSize])

  // Recalculate displayed image size when container size changes
  useEffect(() => {
    if (imageSize.width && imageSize.height) {
      calculateDisplayedImageSize()
    }
  }, [imageSize, calculateDisplayedImageSize])

  // Show error when generateError occurs
  useEffect(() => {
    if (generateError) {
      setShowError(true)
    }
  }, [generateError])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const target = e.target as HTMLElement
    if (target.classList.contains('resize-handle')) {
      setIsResizing(true)
      setResizeHandle(target.dataset.handle as ResizeHandle)
    } else if (target.classList.contains('crop-area')) {
      setIsDragging(true)
    }
    setDragStart({ x: e.clientX, y: e.clientY })
  }, [])

  const handleResize = useCallback(
    (mouseX: number, mouseY: number) => {
      if (!containerRef.current || !displayedImageSize.width) return

      const rect = containerRef.current.getBoundingClientRect()
      const scaleX = imageSize.width / displayedImageSize.width
      const scaleY = imageSize.height / displayedImageSize.height

      // Convert mouse position to image coordinates
      const imageX = (mouseX - rect.left - displayedImageSize.offsetX) * scaleX
      const imageY = (mouseY - rect.top - displayedImageSize.offsetY) * scaleY

      setCropArea((prev) => {
        let newX = prev.x
        let newY = prev.y
        let newSize = prev.size

        switch (resizeHandle) {
          case 'nw':
            newSize = Math.max(
              50,
              Math.min(prev.x + prev.size - imageX, prev.y + prev.size - imageY)
            )
            newX = prev.x + prev.size - newSize
            newY = prev.y + prev.size - newSize
            break
          case 'ne':
            newSize = Math.max(50, Math.min(imageX - prev.x, prev.y + prev.size - imageY))
            newY = prev.y + prev.size - newSize
            break
          case 'sw':
            newSize = Math.max(50, Math.min(prev.x + prev.size - imageX, imageY - prev.y))
            newX = prev.x + prev.size - newSize
            break
          case 'se':
            newSize = Math.max(50, Math.min(imageX - prev.x, imageY - prev.y))
            break
          case 'n':
            newSize = Math.max(50, prev.y + prev.size - imageY)
            newY = prev.y + prev.size - newSize
            break
          case 's':
            newSize = Math.max(50, imageY - prev.y)
            break
          case 'e':
            newSize = Math.max(50, imageX - prev.x)
            break
          case 'w':
            newSize = Math.max(50, prev.x + prev.size - imageX)
            newX = prev.x + prev.size - newSize
            break
        }

        // Final bounds checking - this will handle the max size limits
        newX = Math.max(0, Math.min(imageSize.width - newSize, newX))
        newY = Math.max(0, Math.min(imageSize.height - newSize, newY))
        newSize = Math.min(newSize, imageSize.width - newX, imageSize.height - newY)

        return { x: newX, y: newY, size: newSize }
      })
    },
    [
      resizeHandle,
      imageSize.width,
      imageSize.height,
      displayedImageSize.width,
      displayedImageSize.height,
      displayedImageSize.offsetX,
      displayedImageSize.offsetY,
    ]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      if (!containerRef.current || !inputImage || !displayedImageSize.width) return

      // Cancel previous animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }

      // Use requestAnimationFrame to throttle updates
      animationFrameRef.current = requestAnimationFrame(() => {
        if (isResizing && resizeHandle) {
          handleResize(e.clientX, e.clientY)
        } else if (isDragging) {
          const rect = containerRef.current!.getBoundingClientRect()
          const scaleX = imageSize.width / displayedImageSize.width
          const scaleY = imageSize.height / displayedImageSize.height

          const deltaX = (e.clientX - dragStart.x) * scaleX
          const deltaY = (e.clientY - dragStart.y) * scaleY

          setCropArea((prev) => ({
            ...prev,
            x: Math.max(0, Math.min(imageSize.width - prev.size, prev.x + deltaX)),
            y: Math.max(0, Math.min(imageSize.height - prev.size, prev.y + deltaY)),
          }))
          setDragStart({ x: e.clientX, y: e.clientY })
        }
      })
    },
    [
      containerRef,
      inputImage,
      displayedImageSize.width,
      displayedImageSize.height,
      imageSize,
      dragStart,
      isResizing,
      resizeHandle,
      isDragging,
      handleResize,
    ]
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    setIsResizing(false)
    setResizeHandle(null)
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
  }, [])

  async function submitImage() {
    // If we're generating in background, avoid capturing a screenshot placeholder
    // which can appear blank due to cross-origin/image policies. Proceed directly.
    if (generateInBG && (generating || isGenerating)) {
      nextStage()
      return
    }

    // If there's already a generated/cropped image, use it directly
    if (image) {
      nextStage()
      return
    }

    // Otherwise, crop the input image programmatically (avoids capturing crop UI overlays)
    if (inputImage) {
      try {
        const croppedFile = await cropImageWithCoordinates(
          inputImage,
          cropArea.x,
          cropArea.y,
          cropArea.size
        )
        setImage(croppedFile)
      } catch (error) {
        console.error('Error cropping image:', error)
      }
    }
    nextStage()
  }

  const handleUseCroppedImage = useCallback(async () => {
    if (!inputImage) return

    try {
      // Crop the current input image with the current crop area
      const croppedFile = await cropImageWithCoordinates(
        inputImage,
        cropArea.x,
        cropArea.y,
        cropArea.size
      )

      // Set the cropped image as the final image
      setImage(croppedFile)
      setCroppedImage(croppedFile)
      setIsReCropping(false)

      // Go to the next stage
      nextStage()
    } catch (error) {
      console.error('Error cropping image:', error)
    }
  }, [inputImage, cropArea.x, cropArea.y, cropArea.size, setImage, nextStage])

  // Calculate the scale and position for the crop overlay
  const cropScale = displayedImageSize.width / imageSize.width
  const cropOffsetX = displayedImageSize.offsetX
  const cropOffsetY = displayedImageSize.offsetY

  return (
    <div className="animate-fadeIn flex flex-col gap-6" key={forceRerender}>
      {/* Upload zone — only show when no image yet, or allow re-upload */}
      {!inputImage && (
        <FileInput
          file={inputImage}
          setFile={setInputImage}
          noBlankImages
          accept="image/png, image/jpeg, image/webp, image/gif, image/svg"
          acceptText="PNG, JPEG, WEBP, GIF, SVG — must contain a face"
        />
      )}

      {/* Image preview / crop area */}
      {(inputImage || currImage) && (
        <div className="flex flex-col gap-3">
          {/* Context bar */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">
              {generating
                ? 'Generating your AI passport photo…'
                : inputImage && !image
                ? 'Drag to reposition crop · Handles to resize'
                : image
                ? 'Your passport photo'
                : 'Current image'}
            </p>
            {inputImage && (
              <button
                onClick={() => {
                  setInputImage(undefined)
                  setImage(null)
                  setCroppedImage(null)
                  setHasGeneratedImage(false)
                  setIsReCropping(false)
                  setShowError(false)
                }}
                className="text-xs text-slate-500 hover:text-white transition-colors"
              >
                Change photo
              </button>
            )}
          </div>

          {/* Main preview container */}
          <div className="rounded-2xl border border-white/[0.08] bg-slate-900/40 overflow-hidden">
            <div
              id="citizenPic"
              ref={containerRef}
              className="relative w-full aspect-square max-w-[520px] mx-auto select-none"
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {currImage && !inputImage && (
                <IPFSRenderer
                  src={currImage}
                  className="rounded-none"
                  width={600}
                  height={600}
                  alt="Citizen Image"
                />
              )}
              {inputImage && (
                <>
                  {image && !generating && generatedImageUrl ? (
                    <img
                      src={generatedImageUrl}
                      className="absolute inset-0 w-full h-full object-contain"
                      alt="Generated passport"
                    />
                  ) : generating ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-900/80">
                      <Image
                        src="/assets/MoonDAO-Loading-Animation.svg"
                        width={96}
                        height={96}
                        className="animate-pulse"
                        alt="Generating"
                      />
                      <p className="text-sm text-slate-400 animate-pulse">
                        Creating your AI image…
                      </p>
                    </div>
                  ) : (
                    <>
                      <img
                        ref={imageRef as any}
                        src={inputImageUrl!}
                        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                        alt="Uploaded photo"
                      />

                      {/* Crop overlay */}
                      {displayedImageSize.width > 0 && (
                        <>
                          <div
                            className="crop-area absolute border-2 border-indigo-400 bg-indigo-400/10 cursor-move"
                            style={{
                              left: cropArea.x * cropScale + cropOffsetX,
                              top: cropArea.y * cropScale + cropOffsetY,
                              width: cropArea.size * cropScale,
                              height: cropArea.size * cropScale,
                              boxShadow: '0 0 0 1px rgba(99,102,241,0.3)',
                            }}
                            onMouseDown={handleMouseDown}
                          >
                            {/* Corner handles */}
                            {(['nw', 'ne', 'sw', 'se'] as const).map((handle) => (
                              <div
                                key={handle}
                                className="resize-handle absolute w-3.5 h-3.5 bg-indigo-400 border-2 border-white rounded-full shadow-lg"
                                data-handle={handle}
                                style={{
                                  top: handle.includes('n') ? -7 : undefined,
                                  bottom: handle.includes('s') ? -7 : undefined,
                                  left: handle.includes('w') ? -7 : undefined,
                                  right: handle.includes('e') ? -7 : undefined,
                                  cursor: `${handle}-resize`,
                                }}
                                onMouseDown={handleMouseDown}
                              />
                            ))}
                            {/* Edge handles */}
                            {(['n', 's', 'e', 'w'] as const).map((handle) => (
                              <div
                                key={handle}
                                className="resize-handle absolute w-3 h-3 bg-indigo-400 border-2 border-white rounded-full shadow-lg"
                                data-handle={handle}
                                style={{
                                  top:
                                    handle === 'n'
                                      ? -6
                                      : handle === 's'
                                      ? undefined
                                      : '50%',
                                  bottom: handle === 's' ? -6 : undefined,
                                  left:
                                    handle === 'w'
                                      ? -6
                                      : handle === 'e'
                                      ? undefined
                                      : '50%',
                                  right: handle === 'e' ? -6 : undefined,
                                  transform:
                                    handle === 'n' || handle === 's'
                                      ? 'translateX(-50%)'
                                      : 'translateY(-50%)',
                                  cursor: `${handle}-resize`,
                                }}
                                onMouseDown={handleMouseDown}
                              />
                            ))}
                          </div>

                          {/* Dark overlay outside crop */}
                          <div className="absolute inset-0 pointer-events-none">
                            <div
                              className="absolute bg-black/60"
                              style={{
                                left: 0,
                                top: 0,
                                width: cropArea.x * cropScale + cropOffsetX,
                                height: displayedImageSize.height + cropOffsetY,
                              }}
                            />
                            <div
                              className="absolute bg-black/60"
                              style={{
                                left:
                                  (cropArea.x + cropArea.size) * cropScale + cropOffsetX,
                                top: 0,
                                width:
                                  displayedImageSize.width -
                                  (cropArea.x + cropArea.size) * cropScale,
                                height: displayedImageSize.height + cropOffsetY,
                              }}
                            />
                            <div
                              className="absolute bg-black/60"
                              style={{
                                left: cropArea.x * cropScale + cropOffsetX,
                                top: 0,
                                width: cropArea.size * cropScale,
                                height: cropArea.y * cropScale + cropOffsetY,
                              }}
                            />
                            <div
                              className="absolute bg-black/60"
                              style={{
                                left: cropArea.x * cropScale + cropOffsetX,
                                top:
                                  (cropArea.y + cropArea.size) * cropScale + cropOffsetY,
                                width: cropArea.size * cropScale,
                                height:
                                  displayedImageSize.height -
                                  (cropArea.y + cropArea.size) * cropScale,
                              }}
                            />
                          </div>
                        </>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Error message */}
          {showError && generateError && (
            <p className="text-sm text-red-400/80 px-1">{generateError}</p>
          )}
        </div>
      )}

      {/* Action buttons */}
      {inputImage && !image && !generating && (
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            className="flex-1 py-3 px-6 gradient-2 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 rounded-2xl font-semibold text-white text-sm flex items-center justify-center gap-2"
            onClick={handleGenerateImage}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
            Generate AI Photo
          </button>
          <button
            className="flex-1 py-3 px-6 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] hover:border-white/[0.2] transition-all duration-200 rounded-2xl font-semibold text-white text-sm"
            onClick={handleUseCroppedImage}
          >
            Use Cropped Image
          </button>
        </div>
      )}

      {inputImage && (image || generating) && (
        <div className="flex flex-col sm:flex-row gap-3">
          {!generating && (
            <button
              className="py-3 px-6 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] hover:border-white/[0.2] transition-all duration-200 rounded-2xl font-medium text-white text-sm"
              onClick={() => {
                if (originalInputImage) {
                  setIsReCropping(true)
                  setInputImage(originalInputImage)
                  setCroppedImage(null)
                  setImage(null)
                  setHasGeneratedImage(false)
                  setShowError(false)
                  const minDimension = Math.min(imageSize.width, imageSize.height)
                  setCropArea({
                    x: (imageSize.width - minDimension) / 2,
                    y: (imageSize.height - minDimension) / 2,
                    size: minDimension,
                  })
                }
              }}
            >
              Re-crop
            </button>
          )}
          <button
            className="flex-1 py-3 px-6 gradient-2 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 rounded-2xl font-semibold text-white text-sm flex items-center justify-center gap-2"
            onClick={() => {
              setIsGenerating(true)
              setImage(null)
              setHasGeneratedImage(false)
              setShowError(false)
              generateImage(croppedImage || undefined)
            }}
          >
            {generating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating…
              </>
            ) : hasGeneratedImage ? (
              'Regenerate'
            ) : (
              'Generate AI Photo'
            )}
          </button>
        </div>
      )}

      {/* Next / Continue */}
      {((currImage && !inputImage) || image || (generateInBG && inputImage)) && (
        <button
          className="w-full py-3 gradient-2 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 rounded-2xl font-semibold text-white flex items-center justify-center gap-2"
          onClick={submitImage}
        >
          Continue
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </div>
  )
}
