import Image from 'next/image'
import { useState } from 'react'
import { getIPFSGateway } from '@/lib/ipfs/gateway'

type IPFSRendererProps = {
  src: string
  alt: string
  width: number
  height: number
  className?: string
  fallback?: string
  priority?: boolean
  sizes?: string
  loading?: 'lazy' | 'eager'
}

export default function IPFSRenderer({
  src,
  alt,
  width,
  height,
  className,
  fallback,
  priority = false,
  sizes,
  loading = 'lazy',
}: IPFSRendererProps) {
  const [imageError, setImageError] = useState(false)
  const noSrc = !src || src === ''

  // Use fallback image if provided and error occurs or no src
  const imageSrc =
    (imageError || noSrc) && fallback ? fallback : imageError || noSrc ? '' : getIPFSGateway(src)

  return (
    <div className="relative flex w-full h-full items-center justify-center overflow-hidden">
      {imageSrc ? (
        <Image
          className={className}
          src={imageSrc}
          alt={alt}
          width={width}
          height={height}
          priority={priority}
          sizes={sizes || `(max-width: 768px) 100vw, (max-width: 1200px) 50vw, ${width}px`}
          loading={priority ? undefined : loading}
          onError={() => setImageError(true)}
        />
      ) : (
        <p className="text-white text-xs text-center truncate px-1">
          {alt}
        </p>
      )}
    </div>
  )
}
