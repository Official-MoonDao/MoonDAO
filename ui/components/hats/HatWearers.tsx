//Hat wearers for a specific hat
import { useState } from 'react'
import { useHatData } from '@/lib/hats/useHatData'

type HatWearersProps = {
  hatsContract: any
  hatId: string
  wearers: any[]
}

export function HatWearers({ hatsContract, hatId, wearers }: HatWearersProps) {
  const [dropdownEnabled, setDropdownEnabled] = useState(false)

  const hatData = useHatData(hatsContract, hatId)

  return (
    <div className="px-4 flex flex-col ">
      <div className="flex gap-2 justify-between">
        <div className="flex flex-col gap-2">
          {wearers.map(({ id }) => (
            <div key={hatData.name + id}>
              <p>{`${id.slice(0, 6)}...${id.slice(-4)} (${hatData.name})`}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
