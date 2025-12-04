import html2canvas from 'html2canvas-pro'
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

  const handleAutoCrop = useCallback(async () => {
    if (!inputImage || isReCropping) return

    try {
      const croppedFile = await cropImageWithCoordinates(
        inputImage,
        cropArea.x,
        cropArea.y,
        cropArea.size
      )
      setCroppedImage(croppedFile)
      setImage(croppedFile) // Set the cropped image as the final image
    } catch (error) {
      console.error('Error auto-cropping image:', error)
    }
  }, [inputImage, cropArea.x, cropArea.y, cropArea.size, setImage, isReCropping])

  // Auto-crop when input image changes (but not when re-cropping)
  useEffect(() => {
    if (inputImage && !croppedImage && !isReCropping && !currImage) {
      handleAutoCrop()
    }
  }, [inputImage, croppedImage, handleAutoCrop, isReCropping, currImage])

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

      // Set the cropped image as the new input image for generation
      setInputImage(croppedFile)
      setImage(null) // Clear any existing generated image
      setShowError(false)

      // Generate the AI image using the cropped version
      await generateImage() // This will set the hook's isLoading to true
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
    setInputImage,
    setImage,
    generateImage,
    onGenerationStateChange,
  ])

  // When generation completes (success or failure), update image and reset local generating
  useEffect(() => {
    if (!generating) {
      if (generateError && croppedImage) {
        setImage(croppedImage)
      }
      setIsGenerating(false)
    }
  }, [generating, generateError, croppedImage, setImage])

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

  // Track when image has been generated
  useEffect(() => {
    if (image && !generating) {
      setHasGeneratedImage(true)
    }
  }, [image, generating])

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

    if (!document.getElementById('citizenPic')) return console.error('citizenPic is not defined')
    if (inputImage) {
      // @ts-expect-error
      await html2canvas(document.getElementById('citizenPic')).then((canvas) => {
        const img = canvas.toDataURL('image/png')

        //Convert from base64 to file
        const byteString = atob(img.split(',')[1])
        const mimeString = img.split(',')[0].split(':')[1].split(';')[0]
        const ab = new ArrayBuffer(byteString.length)
        const ia = new Uint8Array(ab)
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i)
        }
        const blob = new Blob([ab], { type: mimeString })
        const file = new File([blob], 'citizenPic.png', { type: mimeString })

        setImage(file)
      })
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
    <div className="animate-fadeIn flex flex-col" key={forceRerender}>
      <div className="flex items-start flex-col mt-5">
        <FileInput
          file={inputImage}
          setFile={setInputImage}
          noBlankImages
          accept="image/png, image/jpeg, image/webp, image/gif, image/svg"
          acceptText="Accepted file types: PNG, JPEG, WEBP, GIF, SVG"
        />
      </div>

      <div className="mt-4">
        <h3 className="text-lg font-semibold mb-2 text-white">
          {inputImage ? 'Crop your image' : 'Preview'}
        </h3>
        <p className="text-sm text-white/60 mb-4">
          {inputImage
            ? 'Drag the crop area to move it, or drag the handles to resize'
            : 'Upload an image to get started'}
        </p>
      </div>

      <div
        id="citizenPic"
        ref={containerRef}
        className="relative w-[90vw] rounded-[5vmax] rounded-tl-[20px] h-[90vw] md:w-[430px] md:h-[430px] lg:w-[600px] lg:h-[600px] bg-cover justify-left flex select-none"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {currImage && !inputImage && (
          <IPFSRenderer src={currImage} className="" width={600} height={600} alt="Citizen Image" />
        )}
        {inputImage && (
          <>
            {image && !generating ? (
              <Image
                src={URL.createObjectURL(image)}
                layout="fill"
                objectFit="contain"
                className=""
                alt={''}
              />
            ) : generating ? (
              <Image
                src={'/assets/MoonDAO-Loading-Animation.svg'}
                layout="fill"
                objectFit="contain"
                className=""
                alt={''}
              />
            ) : (
              <>
                <Image
                  ref={imageRef}
                  src={URL.createObjectURL(inputImage)}
                  layout="fill"
                  objectFit="contain"
                  className="pointer-events-none"
                  alt={''}
                />

                {/* Crop overlay - always show when we have input image and no final image */}
                {displayedImageSize.width > 0 && (
                  <>
                    <div
                      className="crop-area absolute border-2 border-blue-400 bg-blue-400/20 cursor-move rounded-lg"
                      style={{
                        left: cropArea.x * cropScale + cropOffsetX,
                        top: cropArea.y * cropScale + cropOffsetY,
                        width: cropArea.size * cropScale,
                        height: cropArea.size * cropScale,
                      }}
                      onMouseDown={handleMouseDown}
                    >
                      {/* All the resize handles */}
                      <div
                        className="resize-handle absolute w-3 h-3 bg-blue-400 border border-white rounded-full cursor-nw-resize"
                        data-handle="nw"
                        style={{ top: -6, left: -6 }}
                        onMouseDown={handleMouseDown}
                      />
                      <div
                        className="resize-handle absolute w-3 h-3 bg-blue-400 border border-white rounded-full cursor-ne-resize"
                        data-handle="ne"
                        style={{ top: -6, right: -6 }}
                        onMouseDown={handleMouseDown}
                      />
                      <div
                        className="resize-handle absolute w-3 h-3 bg-blue-400 border border-white rounded-full cursor-sw-resize"
                        data-handle="sw"
                        style={{ bottom: -6, left: -6 }}
                        onMouseDown={handleMouseDown}
                      />
                      <div
                        className="resize-handle absolute w-3 h-3 bg-blue-400 border border-white rounded-full cursor-se-resize"
                        data-handle="se"
                        style={{ bottom: -6, right: -6 }}
                        onMouseDown={handleMouseDown}
                      />

                      {/* Edge handles */}
                      <div
                        className="resize-handle absolute w-3 h-3 bg-blue-400 border border-white rounded-full cursor-n-resize"
                        data-handle="n"
                        style={{
                          top: -6,
                          left: '50%',
                          transform: 'translateX(-50%)',
                        }}
                        onMouseDown={handleMouseDown}
                      />
                      <div
                        className="resize-handle absolute w-3 h-3 bg-blue-400 border border-white rounded-full cursor-s-resize"
                        data-handle="s"
                        style={{
                          bottom: -6,
                          left: '50%',
                          transform: 'translateX(-50%)',
                        }}
                        onMouseDown={handleMouseDown}
                      />
                      <div
                        className="resize-handle absolute w-3 h-3 bg-blue-400 border border-white rounded-full cursor-e-resize"
                        data-handle="e"
                        style={{
                          right: -6,
                          top: '50%',
                          transform: 'translateY(-50%)',
                        }}
                        onMouseDown={handleMouseDown}
                      />
                      <div
                        className="resize-handle absolute w-3 h-3 bg-blue-400 border border-white rounded-full cursor-w-resize"
                        data-handle="w"
                        style={{
                          left: -6,
                          top: '50%',
                          transform: 'translateY(-50%)',
                        }}
                        onMouseDown={handleMouseDown}
                      />
                    </div>

                    {/* Dark overlay */}
                    <div className="absolute inset-0 pointer-events-none">
                      <div
                        className="absolute bg-black/50"
                        style={{
                          left: 0,
                          top: 0,
                          width: cropArea.x * cropScale + cropOffsetX,
                          height: displayedImageSize.height + cropOffsetY,
                        }}
                      />
                      <div
                        className="absolute bg-black/50"
                        style={{
                          left: (cropArea.x + cropArea.size) * cropScale + cropOffsetX,
                          top: 0,
                          width:
                            displayedImageSize.width - (cropArea.x + cropArea.size) * cropScale,
                          height: displayedImageSize.height + cropOffsetY,
                        }}
                      />
                      <div
                        className="absolute bg-black/50"
                        style={{
                          left: cropArea.x * cropScale + cropOffsetX,
                          top: 0,
                          width: cropArea.size * cropScale,
                          height: cropArea.y * cropScale + cropOffsetY,
                        }}
                      />
                      <div
                        className="absolute bg-black/50"
                        style={{
                          left: cropArea.x * cropScale + cropOffsetX,
                          top: (cropArea.y + cropArea.size) * cropScale + cropOffsetY,
                          width: cropArea.size * cropScale,
                          height:
                            displayedImageSize.height - (cropArea.y + cropArea.size) * cropScale,
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

      {showError && generateError && <p className="mt-2 ml-2 opacity-[50%]">{generateError}</p>}

      {inputImage && !image && !generating ? (
        <div className="flex gap-2 mt-6">
          <button
            className="px-8 py-2 gradient-2 hover:scale-105 transition-transform rounded-xl font-medium text-base"
            onClick={handleGenerateImage}
          >
            Generate Image
          </button>
          <button
            className="px-8 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            onClick={handleUseCroppedImage}
          >
            Use Cropped Image
          </button>
        </div>
      ) : (
        <></>
      )}

      {inputImage && (image || generating) && (
        <div className="flex gap-2 mt-6">
          {!generating && (
            <button
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              onClick={() => {
                // Restore original image and reset to cropping mode
                if (originalInputImage) {
                  setIsReCropping(true)
                  setInputImage(originalInputImage) // Use the stored original image
                  setCroppedImage(null)
                  setImage(null)
                  setHasGeneratedImage(false)
                  setShowError(false)

                  // Reset the crop area to center when re-cropping
                  // Initialize as largest possible square (full width or height)
                  const minDimension = Math.min(imageSize.width, imageSize.height)
                  setCropArea({
                    x: (imageSize.width - minDimension) / 2,
                    y: (imageSize.height - minDimension) / 2,
                    size: minDimension,
                  })
                }
              }}
            >
              Re-crop Image
            </button>
          )}
          <button
            className="px-8 py-2 gradient-2 hover:scale-105 transition-transform rounded-xl font-medium text-base"
            onClick={() => {
              setIsGenerating(true)
              setImage(null)
              setHasGeneratedImage(false)
              setShowError(false)
              generateImage()
            }}
          >
            {generating ? 'Generating...' : hasGeneratedImage ? 'Generate Image' : 'Generate Image'}
          </button>
        </div>
      )}

      {(currImage && !inputImage) || image || (generateInBG && inputImage) ? (
        <button
          className="mt-6 w-auto px-8 py-2 gradient-2 hover:scale-105 transition-transform rounded-xl font-medium text-base"
          onClick={submitImage}
        >
          Next
        </button>
      ) : (
        <></>
      )}
    </div>
  )
}
