import { useRouter } from 'next/router'
import { useContext, useState } from 'react'
import CitizenContext from '@/lib/citizen/citizen-context'
import { generatePrettyLinkWithId } from '@/lib/subscription/pretty-links'
import IPFSRenderer from '../layout/IPFSRenderer'
import { LoadingSpinner } from '../layout/LoadingSpinner'

export default function CitizenProfileLink() {
  const router = useRouter()
  const { citizen } = useContext(CitizenContext)

  const [isLoading, setIsLoading] = useState<boolean>(false)

  if (citizen?.metadata?.name) {
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
            <IPFSRenderer
              className=""
              src={citizen.metadata.image}
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
