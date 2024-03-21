//Hat wearers for a specific hat
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { useResolvedMediaType } from '@thirdweb-dev/react'
import { useEffect, useState } from 'react'
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
      <div className="flex">
        <h1>{`${hatData.name} (${hatData.supply})`}</h1>

        {/* rotate button with tailwind */}
        <button
          className={`ease-in-out duration-300 ${
            dropdownEnabled && 'rotate-180'
          }`}
          onClick={() => setDropdownEnabled(!dropdownEnabled)}
        >
          <ChevronDownIcon height={30} width={30} />
        </button>
      </div>
      <div className="flex gap-2 justify-between max-h-[300px] overflow-y-scroll">
        {dropdownEnabled && (
          <div className="flex flex-col gap-2">
            {wearers.map(({ id }) => (
              <div key={hatData.name + id}>
                <p>{id.slice(0, 6) + '...' + id.slice(-4)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
