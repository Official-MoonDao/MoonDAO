import Image from 'next/image'
import IPFSRenderer from './IPFSRenderer'

export interface AdaptiveImageProps {
  src?: string | File | null
  alt?: string
  width?: number
  height?: number
  className?: string
  fallback?: React.ReactNode
}

export default function AdaptiveImage({
  src,
  alt = '',
  width = 200,
  height = 200,
  className = '',
  fallback,
}: AdaptiveImageProps) {
  if (!src) {
    return fallback ? <>{fallback}</> : null
  }

  const imageSrc = typeof src === 'string' ? src : URL.createObjectURL(src)
  const isBlob = typeof src === 'string' && src.startsWith('blob:')

  if (isBlob || typeof src === 'object') {
    return <Image className={className} src={imageSrc} alt={alt} width={width} height={height} />
  }

  return (
    <IPFSRenderer className={className} src={imageSrc} width={width} height={height} alt={alt} />
  )
}
