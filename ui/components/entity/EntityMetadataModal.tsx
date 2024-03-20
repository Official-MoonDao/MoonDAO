import { useResolvedMediaType } from '@thirdweb-dev/react'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

export function EntityMetadataModal({
  nft,
  entityData,
  updateMetadata,
  setEnabled,
}: any) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const [entityName, setEntityName] = useState(entityData.name || '')
  const [entityDescription, setEntityDescription] = useState(
    entityData.description || ''
  )
  const [entityWebsite, setEntityWebsite] = useState(entityData.website || '')
  const [entityTwitter, setEntityTwitter] = useState(entityData.twitter || '')
  const [entityCommunications, setEntityCommunications] = useState(
    entityData.communications || ''
  )
  const [entityView, setEntityView] = useState(entityData.isPublic || false)

  const resolvedMetadata = useResolvedMediaType(nft?.metadata?.uri)

  return (
    <div
      onMouseDown={(e: any) => {
        if (e.target.id === 'entity-metadata-modal-backdrop') setEnabled(false)
      }}
      id="entity-metadata-modal-backdrop"
      className="fixed top-0 left-0 w-screen h-screen bg-[#00000080] backdrop-blur-sm flex justify-center items-center z-[1000]"
    >
      <div className="w-full flex flex-col gap-2 items-start justify-start w-auto md:w-[500px] p-4 md:p-8 bg-[#080C20] rounded-md">
        <h1 className="text-2xl font-bold">Update Info</h1>
        <h1 className="font-bold">Info</h1>
        <div className="w-full flex flex-col gap-4 text-black">
          <input
            className="border-2 px-4 py-2 w-full"
            placeholder="Entity Name"
            value={entityName}
            onChange={(e: any) => setEntityName(e.target.value)}
          />
          <input
            className="border-2 px-4 py-2 w-full"
            placeholder="Entity Description"
            value={entityDescription}
            onChange={(e: any) => setEntityDescription(e.target.value)}
          />
        </div>
        <h1 className="font-bold">Socials</h1>
        <div className="w-full flex flex-col gap-4 text-black">
          <input
            className="border-2 px-4 py-2 w-full"
            placeholder="Entity Website"
            value={entityWebsite}
            onChange={(e: any) => setEntityWebsite(e.target.value)}
          />
          <input
            className="border-2 px-4 py-2 w-full"
            placeholder="Entity Twitter"
            value={entityTwitter}
            onChange={(e: any) => setEntityTwitter(e.target.value)}
          />
          <input
            className="border-2 px-4 py-2 w-full"
            placeholder="Entity Communications"
            value={entityCommunications}
            onChange={(e: any) => setEntityCommunications(e.target.value)}
          />
        </div>
        <div className="flex gap-4">
          <p className="text-sm">{`Would you like this entity to be public?`}</p>
          <input
            className="border-2 px-4 py-2"
            placeholder="Entity View"
            type="checkbox"
            defaultChecked={entityView}
            onChange={(e: any) =>
              e.target.checked
                ? setEntityView('public')
                : setEntityView('private')
            }
          />
        </div>

        <button
          className="border-2 px-4 py-2"
          disabled={isLoading}
          onClick={async () => {
            setIsLoading(true)
            const rawMetadataRes = await fetch(resolvedMetadata.url)
            const rawMetadata = await rawMetadataRes.json()
            const imageIPFSLink = rawMetadata.image

            const metadata = {
              name: entityName,
              description: entityDescription,
              image: imageIPFSLink,
              attributes: [
                {
                  trait_type: 'twitter',
                  value: entityTwitter,
                },
                {
                  trait_type: 'communications',
                  value: entityCommunications,
                },
                {
                  trait_type: 'website',
                  value: entityWebsite,
                },
                {
                  trait_type: 'view',
                  value: entityView ? 'public' : 'private',
                },
              ],
            }

            await updateMetadata(metadata)

            setIsLoading(false)
            setEnabled(false)
            router.reload()
          }}
        >
          {isLoading ? 'Updating...' : 'Update'}
        </button>
      </div>
    </div>
  )
}
