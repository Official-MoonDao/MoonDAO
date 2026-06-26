import { TrashIcon, UserPlusIcon, ShieldCheckIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { DEFAULT_CHAIN_V5, HATS_ADDRESS } from 'const/config'
import { TEAM_CREATOR_V2_PASSTHROUGH_MODULE_PATCHED_ADDRESSES } from 'const/teams'
import { ethers } from 'ethers'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { readContract } from 'thirdweb'
import { useCitizen } from '@/lib/citizen/useCitizen'
import {
  buildAddRoleTx,
  buildRemoveRoleTx,
  getRoleLabel,
  isValidEthereumAddress,
  requiresSafeTx,
} from '@/lib/hats/teamRoles'
import useHatNames from '@/lib/hats/useHatNames'
import useUniqueHatWearers from '@/lib/hats/useUniqueHatWearers'
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
  setEnabled: (enabled: boolean) => void
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

function HatOption({ hat, managerHatId }: any) {
  const [ipfsName, setIpfsName] = useState<string>()

  useEffect(() => {
    let active = true
    async function getHatMetadata() {
      try {
        const res = await fetch(
          `https://ipfs.io/ipfs/${hat.details.split('ipfs://')[1]}`
        )
        const data = await res.json()
        if (active) setIpfsName(data?.data?.name)
      } catch {
        // Fall back to deterministic label from getRoleLabel.
      }
    }
    if (hat?.details) getHatMetadata()
    return () => {
      active = false
    }
  }, [hat?.details])

  return (
    <option value={hat.id} className="bg-[#0e1630] text-white">
      {getRoleLabel(hat.id, { managerHatId, ipfsName })}
    </option>
  )
}

function RoleBadge({ name }: { name: string }) {
  const lower = name?.toLowerCase() ?? ''
  const isAdmin = lower.includes('admin')
  const isManager = lower.includes('manager')

  if (isAdmin) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-900/60 border border-purple-500/40 text-purple-200">
        <ShieldCheckIcon className="w-3 h-3" />
        {name}
      </span>
    )
  }
  if (isManager) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-900/60 border border-blue-500/40 text-blue-200">
        {name}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-700/60 border border-slate-500/30 text-slate-300">
      {name}
    </span>
  )
}

function TeamMemberName({ selectedChain, address }: any) {
  const citizenNFT = useCitizen(selectedChain, undefined, address)
  return (
    <p className="font-semibold text-white truncate">
      {citizenNFT?.metadata?.name || 'Unknown Member'}
    </p>
  )
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
  adminHatId,
}: any) {
  const hatNames = useHatNames(hatsContract, wearer.hatIds)
  const chainSlug = getChainSlug(selectedChain)
  const [removingHat, setRemovingHat] = useState<string | null>(null)

  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-[#111827] border border-[#1e2a45] hover:bg-[#162035] transition-all duration-200">
      <div className="w-9 h-9 rounded-full bg-[#1a2545] border border-[#2a3a60] flex items-center justify-center flex-shrink-0 text-sm font-bold text-slate-300">
        {wearer.address.slice(2, 4).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <TeamMemberName selectedChain={selectedChain} address={wearer.address} />
        <p className="text-xs text-slate-400 font-mono mt-0.5">
          {`${wearer.address.slice(0, 6)}...${wearer.address.slice(-4)}`}
        </p>
        {hatNames && hatNames.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {hatNames.map((hatName: any) => {
              const label = getRoleLabel(hatName.hatId, {
                managerHatId,
                ipfsName: hatName.name,
              })

              return (
                <div key={`hat-${wearer.address}-${label}`} className="flex items-center gap-1">
                  <RoleBadge name={label} />
                  <button
                    disabled={removingHat === hatName.hatId}
                    onClick={async () => {
                      setRemovingHat(hatName.hatId)
                      try {
                        const v2TeamCreatorPatchedPassthroughModuleAddress =
                          TEAM_CREATOR_V2_PASSTHROUGH_MODULE_PATCHED_ADDRESSES?.[chainSlug]?.[teamId]

                        let memberHatPassthroughModuleAddress: any = ''
                        if (v2TeamCreatorPatchedPassthroughModuleAddress) {
                          memberHatPassthroughModuleAddress = v2TeamCreatorPatchedPassthroughModuleAddress
                        } else {
                          memberHatPassthroughModuleAddress = await readContract({
                            contract: teamContract,
                            method: 'memberPassthroughModule' as string,
                            params: [teamId],
                          })
                        }

                        const tx = buildRemoveRoleTx({
                          hatId: hatName.hatId,
                          wearerAddress: wearer.address,
                          managerHatId,
                          adminHatId,
                          hatsAddress: HATS_ADDRESS,
                          memberPassthroughModuleAddress:
                            memberHatPassthroughModuleAddress,
                        })

                        const iface = new ethers.utils.Interface(HatsABI)
                        const txData = iface.encodeFunctionData(
                          tx.functionName,
                          tx.args
                        )

                        if (tx.routing === 'safe') {
                          await queueSafeTx({ to: tx.to, data: txData, value: '0', safeTxGas: '1000000' })
                          setHasDeletedMember(true)
                        } else {
                          await account?.sendTransaction({
                            to: tx.to,
                            data: txData,
                            value: '0',
                            gas: 1000000,
                          })
                        }
                        toast.success('Role removed.')
                      } catch (err) {
                        console.log(err)
                        toast.error('Failed to remove role.')
                      } finally {
                        setRemovingHat(null)
                      }
                    }}
                    className="p-0.5 text-slate-500 hover:text-red-400 transition-colors disabled:opacity-40"
                    title="Remove role"
                  >
                    {removingHat === hatName.hatId ? (
                      <span className="block w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <TrashIcon className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
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

  const [hasAddedMember, setHasAddedMember] = useState<boolean>(false)
  const [newMemberAddress, setNewMemberAddress] = useState<string>('')
  const [selectedHatId, setSelectedHatId] = useState<any>(reversedHats?.[0]?.id)

  const [hasDeletedMember, setHasDeletedMember] = useState<boolean>(false)

  const { queueSafeTx } = useSafe(multisigAddress)

  const [isValidAddress, setIsValidAddress] = useState(false)

  const safeNetwork = process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? 'arb1' : 'sep'
  const safeUrl = `https://app.safe.global/home?safe=${safeNetwork}:${multisigAddress}`

  const isPrivilegedSelection = requiresSafeTx(
    selectedHatId,
    managerHatId,
    adminHatId
  )

  return (
    <Modal
      id="team-manage-members-modal"
      setEnabled={setEnabled}
      className="fixed inset-0 w-screen h-screen bg-[#00000080] backdrop-blur-sm flex justify-center items-start z-[10000] overflow-y-auto pt-24 md:pt-28 pb-8 px-4 animate-fadeIn"
    >
      <div className="flex flex-col w-full md:w-[520px] max-h-[calc(100vh-8rem)] md:max-h-[calc(100vh-9rem)] overflow-y-auto bg-[#0a0f1e] rounded-2xl border border-[#1e2a45]">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-[#1e2a45]">
          <h2 className="font-GoodTimes text-xl text-white tracking-wide">Manage Team</h2>
          <p className="text-xs text-slate-400 mt-1">Add or remove roles for team members</p>
        </div>

        {/* Members list */}
        <div className="px-6 py-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Current Members
          </p>
          <div className="flex flex-col gap-2 pr-1">
            {uniqueWearers?.[0] ? (
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
                  adminHatId={adminHatId}
                />
              ))
            ) : (
              <p className="text-sm text-slate-500 py-4 text-center">No members yet</p>
            )}
          </div>

          {hasDeletedMember && (
            <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-amber-900/20 border border-amber-500/30 text-amber-300 text-xs">
              <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                Removal queued.{' '}
                <button className="underline font-semibold hover:text-amber-200" onClick={() => window.open(safeUrl)}>
                  Sign & execute in Safe
                </button>{' '}
                to finalize.
              </span>
            </div>
          )}
        </div>

        <div className="h-px bg-[#1e2a45] mx-6" />

        {/* Add member form */}
        <form
          className="px-6 py-5 flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!isValidEthereumAddress(newMemberAddress))
              return toast.error('Please enter a valid Ethereum address (0x...).')

            const tx = buildAddRoleTx({
              hatId: selectedHatId,
              memberAddress: newMemberAddress,
              managerHatId,
              adminHatId,
              hatsAddress: HATS_ADDRESS,
            })

            const iface = new ethers.utils.Interface(HatsABI)
            const txData = iface.encodeFunctionData(tx.functionName, tx.args)

            try {
              if (tx.routing === 'safe') {
                await queueSafeTx({ to: tx.to, data: txData, value: '0', safeTxGas: '1000000' })
                setHasAddedMember(true)
              } else {
                await account?.sendTransaction({ to: tx.to, data: txData, value: '0', gas: 1000000 })
                toast.success('Member added and role granted!')
              }
              setNewMemberAddress('')
              setIsValidAddress(false)
            } catch (err: any) {
              console.log(err.message)
              if (tx.routing === 'safe' && err.message) {
                toast.error('This wallet is not a Safe signer. Connect an authorized wallet.')
              }
            }
          }}
        >
          <div className="flex items-center gap-2">
            <UserPlusIcon className="w-4 h-4 text-slate-400" />
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Add a Member</p>
          </div>

          {/* Role selector */}
          <div className="relative w-full">
            <label className="block text-xs text-slate-500 mb-1 pl-1">Role</label>
            <select
              className="w-full px-4 py-2.5 bg-[#111827] border border-[#1e2a45] rounded-xl text-white text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-[#425eeb]/50 focus:border-[#425eeb]/60 transition-all"
              onChange={({ target }) => setSelectedHatId(target.value)}
              value={selectedHatId}
            >
              {reversedHats.map((hat: any) => (
                <HatOption key={hat.id} hat={hat} managerHatId={managerHatId} />
              ))}
            </select>
            <div className="pointer-events-none absolute right-3 bottom-2.5 text-slate-400">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
              </svg>
            </div>
          </div>

          {/* Safe notice for the manager role (full administrative access) */}
          {isPrivilegedSelection ? (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-blue-900/20 border border-blue-500/25 text-blue-300 text-xs">
              <ShieldCheckIcon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>
                Managers get full administrative access. Granting this role
                requires Safe multisig approval after submission.
              </span>
            </div>
          ) : (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-[#0d1424] border border-[#1e2a45] text-slate-400 text-xs">
              <UserPlusIcon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>
                Members get standard access. To give someone admin-level
                control, assign the Manager role instead.
              </span>
            </div>
          )}

          {/* Address input */}
          <div>
            <label className="block text-xs text-slate-500 mb-1 pl-1">Wallet Address</label>
            <input
              className="w-full px-4 py-2.5 bg-[#111827] border border-[#1e2a45] rounded-xl text-white text-sm font-mono placeholder:text-slate-600 placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-[#425eeb]/50 focus:border-[#425eeb]/60 transition-all"
              placeholder="0x..."
              value={newMemberAddress}
              onChange={({ target }: any) => {
                setNewMemberAddress(target.value)
                setIsValidAddress(isValidEthereumAddress(target.value))
              }}
            />
          </div>

          <PrivyWeb3Button
            requiredChain={DEFAULT_CHAIN_V5}
            label={isPrivilegedSelection ? 'Queue Safe Transaction' : 'Add Member'}
            type="submit"
            className={`w-full gradient-2 rounded-xl py-2.5 text-sm font-semibold transition-all duration-200 ${
              !isValidAddress ? 'opacity-40 cursor-not-allowed' : 'hover:opacity-90'
            }`}
            action={() => {}}
            isDisabled={!isValidAddress}
          />

          {hasAddedMember && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-green-900/20 border border-green-500/30 text-green-300 text-xs">
              <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                Transaction queued.{' '}
                <button className="underline font-semibold hover:text-green-200" onClick={() => window.open(safeUrl)}>
                  Sign & execute in Safe
                </button>{' '}
                to complete.
              </span>
            </div>
          )}
        </form>
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
        className="min-w-[200px] gradient-2 rounded-[2vmax] rounded-bl-[10px] transition-all duration-200 hover:scale-105"
        onClick={() => setManagerModalEnabled(true)}
      >
        {'Manage Team'}
      </StandardButton>
    </div>
  )
}
