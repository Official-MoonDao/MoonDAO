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
  return (
    <Image
      className={className}
      src={src && src !== '' ? getIPFSGateway(src) : ''}
      alt={alt}
      width={width}
      height={height}
    />
  )
}
