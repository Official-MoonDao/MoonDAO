import Image from 'next/image'
import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import useImageGenerator from '@/lib/image-generator/useImageGenerator'
import { clearAiPortraitReady } from '@/lib/image-generator/citizenOnboardingImage'
import { markPendingImageJobUploading } from '@/lib/image-generator/pendingImageJob'
import { cropImageWithCoordinates } from '@/lib/utils/images'
import FileInput from '../layout/FileInput'
import IPFSRenderer from '../layout/IPFSRenderer'
import {
  CitizenImageGenerationProgress,
  computeProgressPct,
  PHASE_LABELS,
  type ImageGenProgressSnapshot,
} from './CitizenImageGenerationProgress'

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | null

// Rotating messages shown during the wait to keep things feeling alive.
const GENERATION_TIPS = [
  'Crafting your MoonDAO astronaut portrait…',
  'Tip: a clear, front-facing photo gives the best results.',
  'Adding some cosmic flair to your image…',
  'Adding the final details to your portrait…',
]

export function ImageGenerator({
  currImage,
  image,
  setImage,
  inputImage,
  setInputImage,
  nextStage,
  generateInBG,
  onGenerationStateChange, // Add this prop
  onGenerationProgress, // Phase / timer / progress for Review while mounted hidden
  onCrop, // Lifts the cropped upload to the parent (used for "Use my photo")
}: any) {
  // In the onboarding flow we generate in the background and advance to the next
  // step immediately; the AI image (and Regenerate / Use-my-photo choices) then
  // live on the Review step. Standalone usages (e.g. the edit modal) stay put.
  const isBackgroundFlow = !!(generateInBG && nextStage)
  const [originalInputImage, setOriginalInputImage] = useState<File | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [croppedImage, setCroppedImage] = useState<File | null>(null)
  // Track the latest generation ID to prevent stale results from overwriting
  const generationIdRef = useRef(0)
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
    phase,
  } = useImageGenerator('/api/image-gen/citizen-image', inputImage, (file: File) => {
    // Only allow the image to be set if this is from the most recent generation
    // (prevents stale results from overwriting newer ones)
    if (generationIdRef.current === activeGenerationIdRef.current) {
      setImage(file)
    }
  })

  // Progress UX while the (cold-start heavy) generation runs.
  const [elapsedMs, setElapsedMs] = useState(0)
  const [tipIndex, setTipIndex] = useState(0)

  useEffect(() => {
    if (!generating) {
      setElapsedMs(0)
      setTipIndex(0)
      return
    }
    const start = Date.now()
    const elapsedTimer = setInterval(() => setElapsedMs(Date.now() - start), 250)
    const tipTimer = setInterval(() => setTipIndex((i) => (i + 1) % GENERATION_TIPS.length), 4000)
    return () => {
      clearInterval(elapsedTimer)
      clearInterval(tipTimer)
    }
  }, [generating])

  const progressPct = useMemo(() => computeProgressPct(phase, elapsedMs), [phase, elapsedMs])

  // Keep the parent Review step in sync while this instance runs in the background.
  useEffect(() => {
    if (!onGenerationProgress) return
    const isActive = isGenerating || generating
    if (!isActive) {
      onGenerationProgress(null)
      return
    }
    const snapshot: ImageGenProgressSnapshot = {
      phase,
      elapsedMs,
      progressPct,
      phaseLabel: PHASE_LABELS[phase] ?? 'Creating your AI image…',
      tipIndex,
    }
    onGenerationProgress(snapshot)
  }, [
    onGenerationProgress,
    isGenerating,
    generating,
    phase,
    elapsedMs,
    progressPct,
    tipIndex,
  ])

  // The working image is an AI result only when it differs from the user's own
  // cropped upload (which is what "Use my photo" / the error fallback set).
  const hasGeneratedImage = !!image && image !== croppedImage

  // Store original image when first uploaded
  useEffect(() => {
    if (inputImage) {
      setOriginalInputImage(inputImage)
    }
  }, [inputImage])

  // Track generation state and notify parent. Only report changes when this
  // component instance is responsible for an active generation (prevents
  // remounts from clearing the flag while a background job is still running).
  const activeGenerationIdRef = useRef<number | null>(null)
  const hasReportedActiveRef = useRef(false)
  useEffect(() => {
    if (onGenerationStateChange) {
      const isActive = isGenerating || generating
      if (isActive) {
        hasReportedActiveRef.current = true
        onGenerationStateChange(true)
      } else if (hasReportedActiveRef.current) {
        // Only report false if we previously reported true
        hasReportedActiveRef.current = false
        onGenerationStateChange(false)
      }
    }
    // Don't clear the parent flag on unmount during background onboarding — the
    // user has already advanced to Profile/Review while generation continues.
    return () => {
      if (
        onGenerationStateChange &&
        hasReportedActiveRef.current &&
        !isBackgroundFlow
      ) {
        hasReportedActiveRef.current = false
        onGenerationStateChange(false)
      }
    }
  }, [isGenerating, generating, onGenerationStateChange, isBackgroundFlow])

  const handleGenerateImage = useCallback(async () => {
    if (!inputImage) return

    // Increment generation ID to mark this as the latest request
    generationIdRef.current += 1
    const currentGenerationId = generationIdRef.current
    activeGenerationIdRef.current = currentGenerationId

    setIsGenerating(true)
    if (onGenerationStateChange) {
      onGenerationStateChange(true)
    }

    // Persist immediately so Privy redirect during crop/upload can resume.
    clearAiPortraitReady()
    markPendingImageJobUploading('/api/image-gen/citizen-image')

    try {
      // First crop the image
      const croppedFile = await cropImageWithCoordinates(
        inputImage,
        cropArea.x,
        cropArea.y,
        cropArea.size,
      )

      // Store the cropped image for fallback / "Use my photo" and lift to parent
      setCroppedImage(croppedFile)
      onCrop?.(croppedFile)

      setImage(null) // Clear any existing generated image
      setShowError(false)

      // Wrap generateImage to check generation ID before updating image
      const generationPromise = generateImage(croppedFile).then(() => {
        // The hook already called setImage, but we can't intercept it.
        // Instead, we rely on the fact that generateImage internally
        // calls setImage only after completion, and we check in the effect.
      })

      if (isBackgroundFlow) {
        nextStage?.()
      } else {
        await generationPromise
      }
    } catch (error) {
      console.error('Error cropping or generating image:', error)
      // Only clear generating state if this is still the current generation
      if (currentGenerationId === generationIdRef.current) {
        setIsGenerating(false)
        if (onGenerationStateChange) {
          onGenerationStateChange(false)
        }
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
    onCrop,
    isBackgroundFlow,
    nextStage,
  ])

  // Regenerate using the existing crop (no re-upload / re-crop needed).
  const handleRegenerate = useCallback(async () => {
    // Increment generation ID to mark this as the latest request
    generationIdRef.current += 1
    const currentGenerationId = generationIdRef.current
    activeGenerationIdRef.current = currentGenerationId

    setIsGenerating(true)
    if (onGenerationStateChange) {
      onGenerationStateChange(true)
    }
    setImage(null)
    setShowError(false)

    try {
      let cropped = croppedImage
      if (!cropped && inputImage) {
        cropped = await cropImageWithCoordinates(inputImage, cropArea.x, cropArea.y, cropArea.size)
        setCroppedImage(cropped)
        onCrop?.(cropped)
      }
      await generateImage(cropped || undefined)
    } catch (error) {
      console.error('Error cropping or generating image:', error)
      // Only clear generating state if this is still the current generation
      if (currentGenerationId === generationIdRef.current) {
        setIsGenerating(false)
        if (onGenerationStateChange) {
          onGenerationStateChange(false)
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    croppedImage,
    inputImage,
    cropArea.x,
    cropArea.y,
    cropArea.size,
    generateImage,
    onCrop,
    onGenerationStateChange,
    setImage,
  ])

  // Use the user's own (cropped) photo instead of the AI version.
  const handleUseMyPhoto = useCallback(async () => {
    try {
      let cropped = croppedImage
      if (!cropped && inputImage) {
        cropped = await cropImageWithCoordinates(inputImage, cropArea.x, cropArea.y, cropArea.size)
      }
      if (cropped) {
        setCroppedImage(cropped)
        setImage(cropped)
        onCrop?.(cropped)
        if (isBackgroundFlow) nextStage?.()
      }
    } catch (error) {
      console.error('Error cropping image:', error)
    }
  }, [
    croppedImage,
    inputImage,
    cropArea.x,
    cropArea.y,
    cropArea.size,
    setImage,
    onCrop,
    isBackgroundFlow,
    nextStage,
  ])

  // When generation completes (success or failure), update image and reset local generating
  useEffect(() => {
    if (!generating) {
      if (generateError && croppedImage) {
        setImage(croppedImage)
      }
      setIsGenerating(false)
    }
  }, [generating, generateError, croppedImage, setImage, image])
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
    if (inputImage && inputImageUrl) {
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
      imgElement.src = inputImageUrl
    }
  }, [inputImage, inputImageUrl, calculateDisplayedImageSize])

  // Recalculate displayed image size when container size changes
  useEffect(() => {
    if (imageSize.width && imageSize.height) {
      calculateDisplayedImageSize()
    }
  }, [imageSize, calculateDisplayedImageSize])

  // In the standalone flow (e.g. the edit-profile modal), keep the cropped
  // upload lifted to the parent as the user positions the crop. This way an
  // uploaded photo becomes the selected image automatically — the user can
  // just save without first clicking "Skip AI and use my photo" / "Use my
  // photo instead". The onboarding background flow manages its own selection,
  // so it's intentionally excluded.
  useEffect(() => {
    if (isBackgroundFlow) return
    if (!inputImage || !cropArea.size) return
    if (generating || isGenerating) return
    if (hasGeneratedImage) return
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const cropped = await cropImageWithCoordinates(
          inputImage,
          cropArea.x,
          cropArea.y,
          cropArea.size,
        )
        if (cancelled) return
        setCroppedImage(cropped)
        onCrop?.(cropped)
      } catch (error) {
        console.error('Error auto-cropping uploaded image:', error)
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [
    isBackgroundFlow,
    inputImage,
    cropArea.x,
    cropArea.y,
    cropArea.size,
    generating,
    isGenerating,
    hasGeneratedImage,
    onCrop,
  ])

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
              Math.min(prev.x + prev.size - imageX, prev.y + prev.size - imageY),
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
    ],
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
    ],
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
      nextStage?.()
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
          cropArea.size,
        )
        setImage(croppedFile)
      } catch (error) {
        console.error('Error cropping image:', error)
      }
    }
    nextStage?.()
  }

  const handleUseCroppedImage = useCallback(async () => {
    if (!inputImage) return

    try {
      // Crop the current input image with the current crop area
      const croppedFile = await cropImageWithCoordinates(
        inputImage,
        cropArea.x,
        cropArea.y,
        cropArea.size,
      )

      // Set the cropped image as the final image
      setImage(croppedFile)
      setCroppedImage(croppedFile)
      onCrop?.(croppedFile)
      setIsReCropping(false)

      nextStage?.()
    } catch (error) {
      console.error('Error cropping image:', error)
    }
  }, [inputImage, cropArea.x, cropArea.y, cropArea.size, setImage, onCrop, nextStage])

  // Calculate the scale and position for the crop overlay
  const cropScale = displayedImageSize.width / imageSize.width
  const cropOffsetX = displayedImageSize.offsetX
  const cropOffsetY = displayedImageSize.offsetY

  return (
    <div className="animate-fadeIn flex flex-col gap-6" key={forceRerender}>
      {/* Upload zone — only show when no image yet, or allow re-upload */}
      {!inputImage && (
        <>
          <FileInput
            file={inputImage}
            setFile={setInputImage}
            noBlankImages
            accept="image/png, image/jpeg, image/webp, image/gif, image/svg"
            acceptText="PNG, JPEG, WEBP, GIF, SVG — must contain a face"
          />
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
            <p className="text-xs font-semibold text-slate-300 mb-1.5">
              For the best result:
            </p>
            <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
              <li>Use a photo cropped to just your head and shoulders.</li>
              <li>Make sure your face is fully visible.</li>
              <li>Pick a clear, well-lit, front-facing photo.</li>
              <li>Avoid hats, sunglasses, or anything covering your face.</li>
            </ul>
          </div>
        </>
      )}

      {/* Image preview / crop area */}
      {(inputImage || currImage) && (
        <div className="flex flex-col gap-3">
          {/* Context bar */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">
              {generating
                ? 'Generating your AI photo…'
                : inputImage && !image
                  ? 'Drag to reposition crop · Handles to resize'
                  : image
                    ? 'Your photo'
                    : 'Current image'}
            </p>
            {inputImage && (
              <button
                onClick={() => {
                  setInputImage(undefined)
                  setImage(null)
                  setCroppedImage(null)
                  onCrop?.(undefined) // Clear parent's croppedInputImage
                  setIsReCropping(false)
                  setShowError(false)
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg transition-all duration-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                Change Photo
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
                      className="animate-fadeIn absolute inset-0 w-full h-full object-contain"
                      alt="Generated photo"
                    />
                  ) : generating ? (
                    <div className="absolute inset-0">
                      {/* Show the user's photo underneath so the frame never looks empty */}
                      {inputImageUrl && (
                        <img
                          src={inputImageUrl}
                          className="absolute inset-0 w-full h-full object-contain opacity-30 blur-[2px]"
                          alt=""
                          aria-hidden="true"
                        />
                      )}
                      <CitizenImageGenerationProgress
                        phase={phase}
                        elapsedMs={elapsedMs}
                        progressPct={progressPct}
                        isBackgroundFlow={isBackgroundFlow}
                        tipIndex={tipIndex}
                        variant="overlay"
                      />
                    </div>
                  ) : inputImageUrl ? (
                    <>
                      <img
                        ref={imageRef}
                        src={inputImageUrl}
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
                                  top: handle === 'n' ? -6 : handle === 's' ? undefined : '50%',
                                  bottom: handle === 's' ? -6 : undefined,
                                  left: handle === 'w' ? -6 : handle === 'e' ? undefined : '50%',
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
                                left: (cropArea.x + cropArea.size) * cropScale + cropOffsetX,
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
                                top: (cropArea.y + cropArea.size) * cropScale + cropOffsetY,
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
                  ) : null}
                </>
              )}
            </div>
          </div>

          {/* Error message */}
          {showError && generateError && (
            <div className="px-1">
              <p className="text-sm text-red-400/80">{generateError}</p>
              <p className="text-xs text-slate-500 mt-1">
                We&apos;ve kept your cropped photo so you can continue, or try generating again.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Primary action: position the crop, then generate (defaults to AI) */}
      {inputImage && !image && !generating && (
        <div className="flex flex-col gap-2">
          <button
            className="w-full py-3 px-6 gradient-2 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 rounded-2xl font-semibold text-white text-sm flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100"
            onClick={handleGenerateImage}
            disabled={isGenerating || generating}
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
          <p className="text-xs text-slate-500 px-1 text-center">
            Crop to just your head and shoulders, keeping your whole face inside the box.{' '}
            {isBackgroundFlow
              ? 'You can continue with the rest of your citizen creation while your portrait generates in the background (~30–60s).'
              : 'Generation usually takes 30–60 seconds.'}
          </p>
          <button
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors underline underline-offset-2 mx-auto disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleUseCroppedImage}
            disabled={isGenerating || generating}
          >
            Skip AI and use my photo
          </button>
        </div>
      )}

      {/* Post-generation choices (in-component for standalone / edit usage; the
          onboarding flow surfaces the same choices on the Review step). */}
      {inputImage && (image || generating) && (
        <div className="flex flex-col gap-3">
          {generating ? (
            <button
              disabled
              className="w-full py-3 px-6 gradient-2 opacity-70 rounded-2xl font-semibold text-white text-sm flex items-center justify-center gap-2 cursor-not-allowed"
            >
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Generating…
            </button>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  className="flex-1 py-3 px-6 gradient-2 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 rounded-2xl font-semibold text-white text-sm flex items-center justify-center gap-2"
                  onClick={handleRegenerate}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  {hasGeneratedImage ? 'Regenerate' : 'Generate AI Photo'}
                </button>
                <button
                  className="flex-1 py-3 px-6 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] hover:border-white/[0.2] transition-all duration-200 rounded-2xl font-semibold text-white text-sm"
                  onClick={handleUseMyPhoto}
                >
                  Use my photo instead
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Next / Continue — only once an image exists (generation auto-advances) */}
      {nextStage && !generating && ((currImage && !inputImage) || image) && (
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
