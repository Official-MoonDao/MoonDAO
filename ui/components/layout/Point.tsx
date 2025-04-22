import Image from 'next/image'

export default function Point({ point }: { point: string }) {
  const [title, description] = point.split(': ')
  return (
    <div className="flex flex-row bg-opacity-3 pb-2 rounded-sm space-x-2">
      <Image
        alt="Bullet Point"
        src={'./assets/icon-star.svg'}
        width={30}
        height={30}
      />
      <p className="">
        <span className="font-semi-bold">{title}:</span> {description}
      </p>
    </div>
  )
}
