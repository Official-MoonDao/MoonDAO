import Image from 'next/image'
import Speaker from './Speaker'

export default function Feature() {
  return (
    <div className="relative">
      <div className="w-[200px] md:w-[400px] lg:w-[600px] h-full absolute bottom-[-3px] right-0">
        <Image
          src="/assets/divider-11.svg"
          alt="Divider 11"
          width={600}
          height={600}
        />
      </div>
    </div>
  )
}
