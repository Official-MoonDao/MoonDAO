import Image from 'next/image'
import { useRouter } from 'next/router'
import { useContext, useState } from 'react'
import CitizenContext from '@/lib/citizen/citizen-context'
import { getIPFSGateway } from '@/lib/ipfs/gateway'
import { generatePrettyLinkWithId } from '@/lib/subscription/pretty-links'
import client from '@/lib/thirdweb/client'
import { LoadingSpinner } from '../layout/LoadingSpinner'

export default function CitizenProfileLink() {
  const router = useRouter()
  const { citizen } = useContext(CitizenContext)

  const [isLoading, setIsLoading] = useState<boolean>(false)

  if (citizen?.metadata?.id !== null && citizen?.metadata?.id !== undefined) {
    return (
      <button
        onClick={async () => {
          setIsLoading(true)
          await router.push(
            `/citizen/${generatePrettyLinkWithId(
              citizen.metadata.name as string,
              citizen.metadata.id
            )}`
          )
          setIsLoading(false)
        }}
      >
        <div className="rounded-[100%] w-[40px] h-[40px] overflow-hidden  animate-fadeIn">
          {isLoading ? (
            <LoadingSpinner />
          ) : (
            <Image
              className=""
              src={getIPFSGateway(citizen.metadata.image || '')}
              width={40}
              height={40}
              alt="Citizen Image"
            />
          )}
        </div>
      </button>
    )
  }
}
