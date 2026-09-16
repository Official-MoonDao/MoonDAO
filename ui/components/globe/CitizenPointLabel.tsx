import Image from 'next/image'
import { getIPFSGateway } from '@/lib/ipfs/gateway'

type CitizenPointLabelProps = {
  formattedAddress: string
  citizens: any[]
}

export default function CitizenPointLabel({ formattedAddress, citizens }: CitizenPointLabelProps) {
  return (
    <div className="hidden md:block absolute w-[50vw] h-[50vh] max-w-[500px] z-[100]">
      <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-4 shadow-2xl">
        <p className="font-bold text-xl text-white break-words max-w-[200px] mb-3">
          {formattedAddress}
        </p>
        <div className="grid grid-cols-5 gap-3">
          {citizens.map((c: any) => {
            const imageSrc = getIPFSGateway(c.image)
            return (
              <div key={c.id} className="flex flex-col items-center gap-1">
                <div className="rounded-full overflow-hidden border-2 border-white/30">
                  {imageSrc ? (
                    <Image
                      className="rounded-full"
                      src={imageSrc}
                      alt={c.name}
                      width={60}
                      height={60}
                    />
                  ) : (
                    <div className="w-[60px] h-[60px] bg-white/10" aria-hidden="true" />
                  )}
                </div>
                <p className="w-[60px] text-center text-xs text-white/90 break-words">
                  {c.name.length > 10 ? c.name.slice(0, 10) + '...' : c.name}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
