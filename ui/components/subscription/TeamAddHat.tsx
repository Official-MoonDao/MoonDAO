import { XMarkIcon } from '@heroicons/react/24/outline'
import { useAddress } from '@thirdweb-dev/react'
import { HATS_ADDRESS } from 'const/config'
import { ethers } from 'ethers'
import { useState } from 'react'
import { pinBlobOrFile } from '@/lib/ipfs/pinBlobOrFile'
import useSafe from '@/lib/safe/useSafe'
import HatsABI from '../../const/abis/Hats.json'
import Modal from '../layout/Modal'
import StandardButton from '../layout/StandardButton'

type TeamAddHatProps = {
  adminHatId: string
  multisigAddress: string
}

type TeamAddHatModalProps = {
  setEnabled: Function
  adminHatId: string
  multisigAddress: string
}

function TeamAddHatModal({
  setEnabled,
  multisigAddress,
  adminHatId,
}: TeamAddHatModalProps) {
  const address = useAddress()
  const [hatData, setHatData] = useState<any>({
    name: '',
    description: '',
    maxSupply: 1,
  })
  const [hasAddedHat, setHasAddedHat] = useState(false)

  const { queueSafeTx } = useSafe(multisigAddress)

  return (
    <Modal id="team-add-hat-modal" setEnabled={setEnabled}>
      <form
        className="w-full flex flex-col gap-2 items-start justify-start w-auto md:w-[500px] p-4 md:p-8 bg-[#080C20] rounded-md"
        onSubmit={async (e) => {
          e.preventDefault()

          try {
            //pin metadata to IPFS, create blob for metadata
            const detailsBlob = new Blob(
              [
                JSON.stringify({
                  type: '1.0',
                  data: {
                    name: hatData.name,
                    description: hatData.description,
                  },
                }),
              ],
              {
                type: 'application/json',
              }
            )

            const { cid: detailsIpfsHash } = await pinBlobOrFile(detailsBlob)

            const iface = new ethers.utils.Interface(HatsABI)

            const txData = iface.encodeFunctionData('createHat', [
              adminHatId,
              'ipfs://' + detailsIpfsHash,
              hatData.maxSupply,
              address,
              address,
              true,
              'ipfs://bafkreiflezpk3kjz6zsv23pbvowtatnd5hmqfkdro33x5mh2azlhne3ah4',
            ])

            await queueSafeTx({
              to: HATS_ADDRESS,
              data: txData,
              value: '0',
            })

            setHasAddedHat(true)
          } catch (err) {
            console.log(err)
          }
        }}
      >
        <div className="w-full flex items-center justify-between">
          <div>
            <h2 className="font-GoodTimes">{'Add a Hat'}</h2>
          </div>
          <button
            type="button"
            className="flex h-10 w-10 border-2 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
            onClick={() => setEnabled(false)}
          >
            <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
          </button>
        </div>
        <input
          type="text"
          placeholder="Name"
          className="w-full p-2 border-2 dark:border-0 dark:bg-[#0f152f] rounded-sm"
          onChange={(e) => {
            setHatData({ ...hatData, name: e.target.value })
          }}
          value={hatData.name}
        />
        <textarea
          placeholder="Description"
          className="w-full p-2 border-2 dark:border-0 dark:bg-[#0f152f] rounded-sm"
          onChange={(e) => {
            setHatData({ ...hatData, description: e.target.value })
          }}
        />
        <div className="flex gap-4 items-center">
          <label className="w-full">Max Supply</label>
          <input
            type="text"
            placeholder="Name"
            className="w-full p-2 border-2 dark:border-0 dark:bg-[#0f152f] rounded-sm"
            onChange={(e) => {
              setHatData({ ...hatData, maxSupply: e.target.value })
            }}
            value={hatData.maxSupply}
          />
        </div>

        <StandardButton
          type="submit"
          className="mt-4 min-w-[200px] gradient-2 rounded-[5vmax]"
        >
          {'Add Hat'}
        </StandardButton>
        {hasAddedHat && (
          <p>
            {`Please sign and execute the transaction in the team's `}
            <button
              className="font-bold text-light-warm"
              onClick={() => {
                const safeNetwork =
                  process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? 'arb1' : 'sep'
                window.open(
                  `https://app.safe.global/home?safe=${safeNetwork}:${multisigAddress}`
                )
              }}
            >
              Safe
            </button>
          </p>
        )}
      </form>
    </Modal>
  )
}

export default function TeamAddHat({
  adminHatId,
  multisigAddress,
}: TeamAddHatProps) {
  const [teamAddHatModalEnabled, setTeamAddHatModalEnabled] = useState(false)

  return (
    <div>
      {teamAddHatModalEnabled && (
        <TeamAddHatModal
          setEnabled={setTeamAddHatModalEnabled}
          multisigAddress={multisigAddress}
          adminHatId={adminHatId}
        />
      )}
      <StandardButton
        className="min-w-[200px] gradient-2 rounded-[5vmax] rounded-bl-[10px]"
        onClick={() => setTeamAddHatModalEnabled(true)}
      >
        {'Add Hat'}
      </StandardButton>
    </div>
  )
}
