import { hatIdDecimalToHex } from '@hatsprotocol/sdk-v1-core'
import { XMarkIcon } from '@heroicons/react/24/outline'
import {
  useAddress,
  useContract,
  useResolvedMediaType,
  useSDK,
} from '@thirdweb-dev/react'
import { HATS_ADDRESS, HATS_PASSTHROUGH_MODULE_ADDRESS } from 'const/config'
import { ethers } from 'ethers'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useHatData } from '@/lib/hats/useHatData'
import useSafe from '@/lib/safe/useSafe'
import HatsABI from '../../const/abis/Hats.json'
import Modal from '../layout/Modal'
import StandardButton from '../layout/StandardButton'

type TeamManageMembersModalProps = {
  hats: any
  hatsContract: any
  selectedChain: any
  setEnabled: Function
  multisigAddress: string
  adminHatId: string
  managerHatId: any
}

type TeamManageMembersProps = {
  hatsContract: any
  selectedChain: any
  hats: any[]
  multisigAddress: string
  adminHatId: string
  managerHatId: any
}

function HatOption({ hat }: any) {
  const [hatMetadata, setHatMetadata] = useState<any>()

  const resolvedMetadata = useResolvedMediaType(hat.details)

  useEffect(() => {
    async function getHatMetadata() {
      const res = await fetch(resolvedMetadata.url)
      const data = await res.json()
      setHatMetadata(data.data)
    }
    getHatMetadata()
  }, [])

  return (
    <option key={hat.id} value={hat.id}>
      {hatMetadata?.name}
    </option>
  )
}

function TeamMember({
  hat,
  selectedChain,
  hatsContract,
  queueSafeTx,
  setHasDeletedMember,
  managerHatId,
}: any) {
  const sdk = useSDK()
  const hatData = useHatData(selectedChain, hatsContract, hat.id)

  return (
    <>
      {hat.wearers.map((w: any, i: number) => (
        <div key={`modal-team-member-wearer-${i}`}>
          <div className="flex justify-between">
            <p className="font-bold">{hatData.name}</p>
            <button
              onClick={async () => {
                const iface = new ethers.utils.Interface(HatsABI)
                const txData = iface.encodeFunctionData('setHatWearerStatus', [
                  hat.id,
                  w.id,
                  false,
                  false,
                ])

                if (hat.id === hatIdDecimalToHex(managerHatId.toString())) {
                  await queueSafeTx({
                    to: HATS_ADDRESS,
                    data: txData,
                    value: '0',
                    gasLimit: 1000000,
                  })
                  setHasDeletedMember(true)
                } else {
                  const signer = sdk?.getSigner()
                  await signer?.sendTransaction({
                    to: HATS_PASSTHROUGH_MODULE_ADDRESS,
                    data: txData,
                    value: '0',
                    gasLimit: 1000000,
                  })
                }
              }}
            >
              <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
            </button>
          </div>
          <p>{w.id}</p>
        </div>
      ))}
    </>
  )
}

function TeamManageMembersModal({
  hats,
  hatsContract,
  selectedChain,
  multisigAddress,
  adminHatId,
  managerHatId,
  setEnabled,
}: TeamManageMembersModalProps) {
  const sdk = useSDK()
  const address = useAddress()

  //Add member form
  const [hasAddedMember, setHasAddedMember] = useState<boolean>(false)
  const [newMemberAddress, setNewMemberAddress] = useState<string>('')
  const [selectedHatId, setSelectedHatId] = useState<any>()
  const [isLoadingNewMember, setIsLoadingNewMember] = useState<boolean>(false)

  //Add hat form
  const [hasAddedHat, setHasAddedHat] = useState<boolean>(false)
  const [hatData, setHatData] = useState<any>({
    name: '',
    description: '',
    maxSupply: 8,
  })
  const [isLoadingNewHat, setIsLoadingNewHat] = useState<boolean>(false)

  const [hasDeletedMember, setHasDeletedMember] = useState<boolean>(false)

  const { queueSafeTx } = useSafe(multisigAddress)

  useEffect(() => {
    setSelectedHatId(hats[0].id)
  }, [])

  return (
    <Modal id="team-manage-members-modal" setEnabled={setEnabled}>
      <div className="w-full flex flex-col gap-2 items-start justify-start w-auto md:w-[500px] p-4 md:p-8 bg-[#080C20] rounded-md">
        <div className="w-full flex items-center justify-between">
          <h2 className="font-GoodTimes">{`Manage Members`}</h2>
          <button
            type="button"
            className="flex h-10 w-10 border-2 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
            onClick={() => setEnabled(false)}
          >
            <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 w-full flex flex-col divide-y-2 max-h-[500px] overflow-auto">
          {hats.map((hat: any, i: number) => (
            <TeamMember
              key={`modal-team-member-${i}`}
              hat={hat}
              selectedChain={selectedChain}
              hatsContract={hatsContract}
              queueSafeTx={queueSafeTx}
              setHasDeletedMember={setHasDeletedMember}
              managerHatId={managerHatId}
            />
          ))}
        </div>
        {hasDeletedMember && (
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
        <hr></hr>
        <form
          className="w-full flex flex-col gap-2 items-start justify-start bg-[#080C20] rounded-md"
          onSubmit={async (e) => {
            e.preventDefault()
            if (
              newMemberAddress.length !== 42 ||
              !newMemberAddress.startsWith('0x')
            )
              return toast.error('Invalid address')

            const hexHatId = hatIdDecimalToHex(selectedHatId)
            const formattedHatId = hexHatId.split('0x')[1]
            const formattedWearer = newMemberAddress.split('0x')[1]
            const txData = `0x641f776e${formattedHatId}000000000000000000000000${formattedWearer}`

            try {
              if (
                selectedHatId === hatIdDecimalToHex(managerHatId.toString())
              ) {
                await queueSafeTx({
                  to: HATS_ADDRESS,
                  data: txData,
                  value: '0',
                })
                setHasAddedMember(true)
              } else {
                const signer = sdk?.getSigner()
                await signer?.sendTransaction({
                  to: HATS_ADDRESS,
                  data: txData,
                  value: '0',
                })
                toast.success('Member added successfully')
              }
              setNewMemberAddress('')
            } catch (err: any) {
              console.log(err.message)
              console.log(selectedHatId, managerHatId)
              if (
                selectedHatId === hatIdDecimalToHex(managerHatId.toString()) &&
                err.message
              ) {
                toast.error(
                  'The connected wallet is not a signer of the gnosis safe.'
                )
              }
            }
          }}
        >
          <div className="w-full flex items-center justify-between">
            <div>
              <h2 className="font-GoodTimes">{'Add a Member'}</h2>
            </div>
          </div>
          <div className="w-full flex flex-col gap-4">
            <select
              className="p-2 bg-[#0f152f]"
              onChange={({ target }) => setSelectedHatId(target.value)}
            >
              {hats.map((hat: any) => (
                <HatOption key={hat.id} hat={hat} />
              ))}
            </select>
            <input
              className="w-full p-2 border-2 dark:border-0 dark:bg-[#0f152f] rounded-sm"
              placeholder="Member Address"
              value={newMemberAddress}
              onChange={({ target }: any) => setNewMemberAddress(target.value)}
            />
          </div>
          <StandardButton
            type="submit"
            className="mt-4 w-full gradient-2 rounded-[5vmax]"
          >
            {'Add Member'}
          </StandardButton>
          {hasAddedMember && (
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
        {/* <form
          className="w-full flex flex-col gap-2 items-start justify-start bg-[#080C20] rounded-md"
          onSubmit={async (e) => {
            e.preventDefault()
            setIsLoadingNewHat(true)
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

              // const iface = new ethers.utils.Interface(HatsABI)

              // const txData = iface.encodeFunctionData('createHat', [
              //   adminHatId,
              //   'ipfs://' + detailsIpfsHash,
              //   hatData.maxSupply,
              //   address,
              //   address,
              //   true,
              //   'ipfs://bafkreiflezpk3kjz6zsv23pbvowtatnd5hmqfkdro33x5mh2azlhne3ah4',
              // ])

              // await queueSafeTx({
              //   to: HATS_ADDRESS,
              //   data: txData,
              //   value: '0',
              // })

              await hatsContract.call('createHat', [
                managerHatId,
                'ipfs://' + detailsIpfsHash,
                hatData.maxSupply,
                multisigAddress,
                multisigAddress,
                true,
                'ipfs://bafkreiflezpk3kjz6zsv23pbvowtatnd5hmqfkdro33x5mh2azlhne3ah4',
              ])
              setHatData({ name: '', description: '', maxSupply: 8 })
              setIsLoadingNewHat(false)
              toast.success('Hat added successfully')
            } catch (err) {
              console.log(err)
            }
          }}
        >
          <div className="w-full flex items-center justify-between">
            <h2 className="font-GoodTimes">{'Add a Hat'}</h2>
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
        </form> */}
      </div>
    </Modal>
  )
}

export default function TeamManageMembers({
  selectedChain,
  hatsContract,
  hats,
  multisigAddress,
  adminHatId,
  managerHatId,
}: TeamManageMembersProps) {
  const [manageMembersModalEnabled, setManagerModalEnabled] = useState(false)
  const { contract: hatsPassthroughModuleContract } = useContract(
    HATS_PASSTHROUGH_MODULE_ADDRESS
  )
  return (
    <div>
      {manageMembersModalEnabled && (
        <TeamManageMembersModal
          selectedChain={selectedChain}
          hatsContract={hatsContract}
          hats={hats}
          setEnabled={setManagerModalEnabled}
          multisigAddress={multisigAddress}
          adminHatId={adminHatId}
          managerHatId={managerHatId}
        />
      )}
      <StandardButton
        className="min-w-[200px] gradient-2 rounded-[2vmax] rounded-bl-[10px]"
        onClick={() => setManagerModalEnabled(true)}
      >
        {'Manage Members'}
      </StandardButton>
    </div>
  )
}
