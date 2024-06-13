import { ThirdwebNftMedia } from '@thirdweb-dev/react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getAttribute } from '@/lib/utils/nft'

export default function EntityCitizenCard({
  metadata,
  owner,
  type,
}: {
  metadata: any
  owner: string
  type: string
}) {
  const [citizenDiscord, setCitizenDiscord] = useState()

  useEffect(() => {
    if (type === 'citizen') {
      setCitizenDiscord(getAttribute(metadata.attributes, 'discord')?.value)
    }
  }, [type])

  return (
    <div>
      {metadata && (
        <Link
          href={`/${type === 'entity' ? 'entity' : 'citizen'}/${metadata.id}`}
          passHref
        >
          <div className="p-4 flex flex-col rounded w-[310px] h-[650px] bg-[#0f152f] hover:scale-105 ease-in-out duration-300 justify-between">
            <ThirdwebNftMedia
              className=""
              metadata={metadata}
              height={'280px'}
              width={'280px'}
            />
            <p
              id="entity-citizen-card-name"
              className="mt-3 text-black dark:text-white text-2xl"
            >
              {metadata.name}
            </p>
            <p className="flex items-center text-moon-orange font-RobotoMono inline-block text-center w-full lg:text-left xl:text-lg">
              {owner.slice(0, 6) + '...' + owner.slice(-4)}
            </p>
            <p
              id="entity-citizen-card-description"
              className="mt-3 h-[100px] text-md text-ellipsis overflow-hidden"
            >
              {metadata.description.length > 100
                ? `${metadata.description.slice(0, 100)}...`
                : metadata.description}
            </p>

            <div className="flex flex-col gap-4">
              <div className="flex gap-4">
                <button
                  id="entity-citizen-card-type"
                  disabled={true}
                  className="w-1/2 px-4 py-2 text-[grey] rounded-full bg-[#e7e5e7] bg-opacity-10 flex items-center"
                >
                  {type === 'entity' ? 'Entity' : 'Citizen'}
                </button>
                <button
                  id="entity-citizen-card-id"
                  disabled={true}
                  className="w-1/2 px-4 py-2 text-blue-500 rounded-full bg-blue-400 bg-opacity-10 flex items-center"
                >
                  ID: {metadata.id}
                </button>
              </div>
              {type === 'citizen' &&
                getAttribute(metadata.attributes, 'discord')?.value && (
                  <div
                    id="citizen-discord"
                    className="p-4 text-indigo-500 rounded-lg bg-indigo-400 bg-opacity-10 inline-flex items-center max-w-full break-all"
                  >
                    {`Discord: @${citizenDiscord}`}
                  </div>
                )}
            </div>
          </div>
        </Link>
      )}
    </div>
  )
}
