import Image from 'next/image'
import { getIPFSGateway } from '@/lib/ipfs/gateway'

type IPFSRendererProps = {
  src: string
  alt: string
  width: number
  height: number
  className?: string
}

export default function IPFSRenderer({
  src,
  alt,
  width,
  height,
  className,
}: IPFSRendererProps) {
  const noSrc = !src || src === ''

  return (
    <div className="flex w-full h-full items-center justify-center">
      {!noSrc && (
        <Image
          className={className}
          src={getIPFSGateway(src)}
          alt={alt}
          width={width}
          height={height}
        />
      )}
      {noSrc && (
        <p className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 text-white text-sm text-center">
          {alt}
        </p>
      )}
    </div>
  )
}
