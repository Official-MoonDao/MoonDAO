import { Chain } from '@thirdweb-dev/chains'
import { ThirdwebNftMedia } from '@thirdweb-dev/react'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { useCitizen } from '@/lib/citizen/useCitizen'
import { generatePrettyLinkWithId } from '@/lib/subscription/pretty-links'
import { LoadingSpinner } from '../layout/LoadingSpinner'

type CitizenProfileLinkProps = {
  selectedChain: Chain
  citizenContract: any
}

export default function CitizenProfileLink({
  selectedChain,
  citizenContract,
}: CitizenProfileLinkProps) {
  const router = useRouter()
  const citizen = useCitizen(selectedChain, citizenContract)

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
            <ThirdwebNftMedia
              className=""
              metadata={citizen.metadata}
              width="100%"
              height="100%"
            />
          )}
        </div>
      </button>
    )
  }
}
