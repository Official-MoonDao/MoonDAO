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
}

export default function IPFSRenderer({
  src,
  alt,
  width,
  height,
  className,
  fallback,
}: IPFSRendererProps) {
  const [imageError, setImageError] = useState(false)
  const noSrc = !src || src === ''

  // Use fallback image if provided and error occurs or no src
  const imageSrc =
    (imageError || noSrc) && fallback ? fallback : imageError || noSrc ? '' : getIPFSGateway(src)

  return (
    <div className="flex w-full h-full items-center justify-center">
      {imageSrc ? (
        <Image
          className={className}
          src={imageSrc}
          alt={alt}
          width={width}
          height={height}
          onError={() => setImageError(true)}
        />
      ) : (
        <p className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 text-white text-sm text-center">
          {alt}
        </p>
      )}
    </div>
  )
}
