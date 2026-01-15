import { useContext, useState } from 'react'
import CitizenContext from '@/lib/citizen/citizen-context'
import { generatePrettyLinkWithId } from '@/lib/subscription/pretty-links'
import IPFSRenderer from '../layout/IPFSRenderer'
import { LoadingSpinner } from '../layout/LoadingSpinner'

export default function CitizenProfileLink() {
  const { citizen } = useContext(CitizenContext)
  const [isLoading, setIsLoading] = useState<boolean>(false)

  if (citizen?.metadata?.name) {
    const name = citizen.metadata.name
    const id = citizen.metadata.id
    const profileUrl = `/citizen/${generatePrettyLinkWithId(name, id)}`
    
    return (
      <a
        href={profileUrl}
        onClick={() => setIsLoading(true)}
        className="flex items-center justify-center"
      >
        <div className="rounded-[100%] w-[40px] h-[40px] overflow-hidden animate-fadeIn flex items-center justify-center">
          {isLoading ? (
            <LoadingSpinner />
          ) : (
            <IPFSRenderer
              className="object-cover"
              src={citizen.metadata.image}
              width={40}
              height={40}
              alt="Citizen Image"
            />
          )}
        </div>
      </a>
    )
  }
}
