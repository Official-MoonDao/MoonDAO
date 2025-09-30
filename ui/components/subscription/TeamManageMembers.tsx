import { hatIdDecimalToHex } from '@hatsprotocol/sdk-v1-core'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { TrashIcon } from '@heroicons/react/24/outline'
import { useWallets } from '@privy-io/react-auth'
import { DEFAULT_CHAIN_V5, HATS_ADDRESS } from 'const/config'
import { TEAM_CREATOR_V2_PASSTHROUGH_MODULE_PATCHED_ADDRESSES } from 'const/teams'
import { ethers } from 'ethers'
import { useContext, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { readContract } from 'thirdweb'
import { useCitizen } from '@/lib/citizen/useCitizen'
import useHatNames from '@/lib/hats/useHatNames'
import useUniqueHatWearers from '@/lib/hats/useUniqueHatWearers'
import PrivyWalletContext from '@/lib/privy/privy-wallet-context'
import useSafe from '@/lib/safe/useSafe'
import { getChainSlug } from '@/lib/thirdweb/chain'
import HatsABI from '../../const/abis/Hats.json'
import Modal from '../layout/Modal'
import StandardButton from '../layout/StandardButton'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'

type TeamManageMembersModalProps = {
  account: any
  hats: any
  hatsContract: any
  teamContract: any
  teamId: string
  selectedChain: any
  setEnabled: Function
  multisigAddress: string
  adminHatId: string
  managerHatId: any
}

type TeamManageMembersProps = {
  account: any
  hats: any[]
  hatsContract: any
  teamContract: any
  teamId: string
  selectedChain: any
  multisigAddress: string
  adminHatId: string
  managerHatId: any
}

function HatOption({ hat }: any) {
  const [hatMetadata, setHatMetadata] = useState<any>()

  useEffect(() => {
    async function getHatMetadata() {
      const res = await fetch(
        `https://ipfs.io/ipfs/${hat.details.split('ipfs://')[1]}`
      )
      const data = await res.json()
      setHatMetadata(data.data)
    }
    getHatMetadata()
  }, [hat.details])

  return (
    <option key={hat.id} value={hat.id} className="bg-[#0f152f] text-white">
      {hatMetadata?.name}
    </option>
  )
}

function TeamMemberName({ selectedChain, address }: any) {
  const citizenNFT = useCitizen(selectedChain, undefined, address)
  return <p className="font-bold">{citizenNFT?.metadata?.name}</p>
}

function TeamMembers({
  account,
  wearer,
  selectedChain,
  hatsContract,
  teamContract,
  teamId,
  queueSafeTx,
  setHasDeletedMember,
  managerHatId,
}: any) {
  const hatNames = useHatNames(hatsContract, wearer.hatIds)

  const chainSlug = getChainSlug(selectedChain)

  return (
    <>
      <div
        key={`modal-team-member-wearer-${wearer.address}`}
        className="bg-dark-cool rounded-[1vmax] mb-2 p-5"
      >
        <TeamMemberName
          selectedChain={selectedChain}
          address={wearer.address}
        />
        <p>{`${wearer.address.slice(0, 5)}...${wearer.address.slice(-5)}`}</p>
        <div className="mt-2 flex flex-col gap-2">
          {hatNames?.map((hatName: any) => (
            <div
              key={`team-member-hat-${wearer.address}-${hatName.name}`}
              className="flex items-start"
            >
              <button
                onClick={async () => {
                  try {
                    const v2TeamCreatorPatchedPassthroughModuleAddress =
                      TEAM_CREATOR_V2_PASSTHROUGH_MODULE_PATCHED_ADDRESSES?.[
                        chainSlug
                      ]?.[teamId]

                    let memberHatPassthroughModuleAddress: any = ''

                    if (v2TeamCreatorPatchedPassthroughModuleAddress) {
                      memberHatPassthroughModuleAddress =
                        v2TeamCreatorPatchedPassthroughModuleAddress
                    } else {
                      memberHatPassthroughModuleAddress = await readContract({
                        contract: teamContract,
                        method: 'memberPassthroughModule' as string,
                        params: [teamId],
                      })
                    }
                    await readContract({
                      contract: teamContract,
                      method: 'memberPassthroughModule' as string,
                      params: [teamId],
                    })
                    const iface = new ethers.utils.Interface(HatsABI)
                    const txData = iface.encodeFunctionData(
                      'setHatWearerStatus',
                      [hatName.hatId, wearer.address, false, true]
                    )

                    if (
                      hatName.hatId ===
                      hatIdDecimalToHex(managerHatId.toString())
                    ) {
                      await queueSafeTx({
                        to: HATS_ADDRESS,
                        data: txData,
                        value: '0',
                        safeTxGas: '1000000',
                      })
                      setHasDeletedMember(true)
                    } else {
                      await account?.sendTransaction({
                        to: memberHatPassthroughModuleAddress,
                        data: txData,
                        value: '0',
                        gas: 1000000,
                      })
                    }
                    toast.success('Member removed successfully!')
                  } catch (err) {
                    console.log(err)
                  }
                }}
              >
                <TrashIcon className="h-6 w-6 text-white" aria-hidden="true" />
              </button>
              <p className="">{hatName.name}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function TeamManageMembersModal({
  account,
  hats,
  hatsContract,
  teamContract,
  teamId,
  selectedChain,
  multisigAddress,
  adminHatId,
  managerHatId,
  setEnabled,
}: TeamManageMembersModalProps) {
  const reversedHats = hats.slice().reverse()

  const uniqueWearers = useUniqueHatWearers(hats)

  //Add member form
  const [hasAddedMember, setHasAddedMember] = useState<boolean>(false)
  const [newMemberAddress, setNewMemberAddress] = useState<string>('')
  const [selectedHatId, setSelectedHatId] = useState<any>(reversedHats?.[0]?.id)
  const [newMemberIsIneligible, setNewMemberIsIneligible] =
    useState<boolean>(false)
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

  const [isValidAddress, setIsValidAddress] = useState(false)

  const validateEthereumAddress = (address: string) => {
    return address.length === 42 && address.startsWith('0x')
  }

  return (
    <Modal id="team-manage-members-modal" setEnabled={setEnabled}>
      <div className="w-full rounded-[2vmax] flex flex-col gap-2 items-start justify-start w-auto md:w-[500px] p-5 py-0 bg-gradient-to-b from-dark-cool to-darkest-cool h-screen md:h-auto">
        <div className="w-full flex mt-5 mb-2 items-end justify-between">
          <h2 className="font-GoodTimes">{`Manage Members`}</h2>
          <button
            type="button"
            className="flex h-10 w-10 border-2 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
            onClick={() => setEnabled(false)}
          >
            <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
          </button>
        </div>

        <div className="border-b-[3px] border-dark-cool rounded-[2vmax] w-full">
          <div className="px-2 pb-0 rounded-[2vmax] bg-darkest-cool w-full flex flex-col max-h-[500px] overflow-auto border-t-[10px] border-b-[10px] border-darkest-cool">
            {uniqueWearers?.[0] &&
              uniqueWearers.map((w: any, i: number) => (
                <TeamMembers
                  key={`modal-team-member-${i}`}
                  account={account}
                  wearer={w}
                  selectedChain={selectedChain}
                  hatsContract={hatsContract}
                  teamContract={teamContract}
                  teamId={teamId}
                  queueSafeTx={queueSafeTx}
                  setHasDeletedMember={setHasDeletedMember}
                  managerHatId={managerHatId}
                />
              ))}
          </div>
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
          className="w-full flex flex-col gap-2 items-start justify-start rounded-[2vmax]"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!validateEthereumAddress(newMemberAddress))
              return toast.error('Invalid address.')

            const iface = new ethers.utils.Interface(HatsABI)
            const txData = iface.encodeFunctionData('mintHat', [
              selectedHatId,
              newMemberAddress,
            ])

            try {
              if (
                selectedHatId === hatIdDecimalToHex(managerHatId.toString())
              ) {
                await queueSafeTx({
                  to: HATS_ADDRESS,
                  data: txData,
                  value: '0',
                  safeTxGas: '1000000',
                })
                setHasAddedMember(true)
              } else {
                await account?.sendTransaction({
                  to: HATS_ADDRESS,
                  data: txData,
                  value: '0',
                  gas: 1000000,
                })
                toast.success('Member added successfully!')
              }
              setNewMemberAddress('')
              setIsValidAddress(false)
            } catch (err: any) {
              console.log(err.message)
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
          <div className="w-full mb-2 flex items-center justify-between">
            <div>
              <h2 className="font-GoodTimes">{'Add a Member'}</h2>
            </div>
          </div>
          <div className="w-full flex flex-col gap-1">
            <div className="relative w-full">
              <select
                className="w-full p-2 px-5 bg-[#0f152f] appearance-none rounded-t-[20px] rounded-b-[5px] text-white border border-[#2a3052] focus:outline-none focus:ring-2 focus:ring-light-warm"
                onChange={({ target }) => setSelectedHatId(target.value)}
                value={selectedHatId}
                style={{
                  WebkitAppearance: 'none',
                  MozAppearance: 'none',
                }}
              >
                {reversedHats.map((hat: any) => (
                  <HatOption key={hat.id} hat={hat} />
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white">
                <svg
                  className="fill-current h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                </svg>
              </div>
            </div>
            <input
              className="w-full p-2 px-5 bg-[#0f152f] rounded-[5px] mt-[3px] text-white border border-[#2a3052] focus:outline-none focus:ring-2 focus:ring-light-warm"
              placeholder="Member Address"
              value={newMemberAddress}
              onChange={({ target }: any) => {
                setNewMemberAddress(target.value)
                const newIsValidAddress = validateEthereumAddress(target.value)
                setIsValidAddress(newIsValidAddress)
              }}
            />
          </div>
          <PrivyWeb3Button
            requiredChain={DEFAULT_CHAIN_V5}
            label="Add Member"
            type="submit"
            className={`w-full mt-[-1px] w-full gradient-2 rounded-[2vmax] rounded-tr-[5px] ${
              !isValidAddress ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            action={() => {}}
            isDisabled={!isValidAddress}
          />
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
        {/* Create Hat */}
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
  account,
  selectedChain,
  hatsContract,
  teamContract,
  teamId,
  hats,
  multisigAddress,
  adminHatId,
  managerHatId,
}: TeamManageMembersProps) {
  const [manageMembersModalEnabled, setManagerModalEnabled] = useState(false)

  return (
    <div>
      {manageMembersModalEnabled && (
        <TeamManageMembersModal
          account={account}
          selectedChain={selectedChain}
          hatsContract={hatsContract}
          teamContract={teamContract}
          teamId={teamId}
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
