import Image from 'next/image'

export default function HeroImage({ asset }: any) {
  if (!asset?.asset)
    return (
      <div
        className={`w-[300px] bg-gradient-to-r from-[#333] via-[#555] to-[#333] bg-[length:400px_400px] animate-pulse duration-[1s] ease-in-out infinite p-2 m-2  h-[362px] bject-cover lg:w-[300px] rounded-tl-[99px] rounded-br-[99px]`}
      />
    )

  return (
    <Image
      className="w-[300px] hover:ring xl:hover:ring-4 ring-moon-orange transition-all duration-300 h-[362px] object-cover lg:w-[400px] xl:w-[400px] 2xl:w-[536px]  rounded-tl-[99px] rounded-br-[99px]"
      src={asset.asset.image}
      alt="Hero Image"
      width={290}
      height={362}
    />
  )
}
