import Image from 'next/image'

type CitizenPointLabelProps = {
  formattedAddress: string
  citizens: any[]
}

export default function CitizenPointLabel({
  formattedAddress,
  citizens,
}: CitizenPointLabelProps) {
  return (
    <div className="hidden md:block absolute w-[50vw] h-[50vh] max-w-[500px] z-[100]">
      <p className="font-bold text-2xl break-words max-w-[200px]">
        {formattedAddress}
      </p>
      <div className="grid grid-cols-5 gap-2">
        {citizens.map((c: any) => (
          <div key={c.id} className="flex flex-col items-center">
            <Image
              className="rounded-full"
              src={`https://ipfs.io/ipfs/${c.image.split('ipfs://')[1]}`}
              alt={c.name}
              width={75}
              height={75}
            />
            <p className="w-[50px]">
              {c.name.length > 10 ? c.name.slice(0, 10) + '...' : c.name}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
