import { hatIdDecimalToHex } from '@hatsprotocol/sdk-v1-core'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { useResolvedMediaType } from '@thirdweb-dev/react'
import { HATS_ADDRESS } from 'const/config'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useSubHats } from '@/lib/hats/useSubHats'
import useSafe from '@/lib/safe/useSafe'
import Modal from '../layout/Modal'
import StandardButton from '../layout/StandardButton'

type TeamAddMemberProps = {
  selectedChain: any
  adminHatId: string
  multisigAddress: string
}

type TeamAddMemberModalProps = {
  setEnabled: Function
  subHats: any
  multisigAddress: string
}

type HatOptionProps = {
  hat: any
}

function HatOption({ hat }: HatOptionProps) {
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

function TeamAddMemberModal({
  subHats,
  setEnabled,
  multisigAddress,
}: TeamAddMemberModalProps) {
  const router = useRouter()
  const [newMemberAddress, setNewMemberAddress] = useState('')
  const [selectedHatId, setSelectedHatId] = useState<any>()
  const [hasAddedMember, setHasAddedMember] = useState(false)

  const { queueSafeTx } = useSafe(multisigAddress)

  useEffect(() => {
    setSelectedHatId(subHats[0]?.id)
  }, [])

  return (
    <Modal id="team-add-hat-modal" setEnabled={setEnabled}>
      <form
        className="w-full flex flex-col gap-2 items-start justify-start w-auto md:w-[500px] p-4 md:p-8 bg-[#080C20] rounded-md"
        onSubmit={async (e) => {
          e.preventDefault()
          if (
            newMemberAddress.length !== 42 ||
            !newMemberAddress.startsWith('0x')
          )
            return toast.error('Invalid address')

          //Add new member to hat Id

          const hexHatId = hatIdDecimalToHex(selectedHatId)
          const formattedHatId = hexHatId.split('0x')[1]
          const formattedWearer = newMemberAddress.split('0x')[1]
          const txData = `0x641f776e${formattedHatId}000000000000000000000000${formattedWearer}`

          try {
            await queueSafeTx({
              to: HATS_ADDRESS,
              data: txData,
              value: '0',
            })
            setHasAddedMember(true)
          } catch (err) {
            console.log(err)
          }
        }}
      >
        <div className="w-full flex items-center justify-between">
          <div>
            <h2 className="font-GoodTimes">{'Manage a Member'}</h2>
          </div>
          <button
            type="button"
            className="flex h-10 w-10 border-2 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
            onClick={() => setEnabled(false)}
          >
            <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
          </button>
        </div>
        <div className="w-full flex flex-col gap-4">
          <select
            className="p-2 bg-[#0f152f]"
            onChange={({ target }) => setSelectedHatId(target.value)}
          >
            {subHats.map((hat: any) => (
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
    </Modal>
  )
}

export default function TeamAddMember({
  selectedChain,
  adminHatId,
  multisigAddress,
}: TeamAddMemberProps) {
  const [teamAddMemberModalEnabled, setTeamAddMemberModalEnabled] =
    useState(false)

  const subHats = useSubHats(selectedChain, adminHatId)

  return (
    <div>
      {teamAddMemberModalEnabled && (
        <TeamAddMemberModal
          setEnabled={setTeamAddMemberModalEnabled}
          subHats={subHats}
          multisigAddress={multisigAddress}
        />
      )}
      <StandardButton
        className="min-w-[200px] gradient-2 rounded-[5vmax]"
        onClick={() => setTeamAddMemberModalEnabled(true)}
      >
        {'Add Member'}
      </StandardButton>
    </div>
  )
}
