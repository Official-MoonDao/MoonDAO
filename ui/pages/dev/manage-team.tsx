import { ShieldCheckIcon, TrashIcon, UserPlusIcon, ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { GetServerSideProps } from 'next'
import { useState } from 'react'

// ─── Mock data ──────────────────────────────────────────────────────────────

// Teams only have two assignable roles on-chain: Manager (admin-level access,
// minted via the Safe) and Member (standard access, minted by a manager). The
// Admin hat is a 1/1 hat worn by the Safe itself and is NOT assignable to a
// person, so it is intentionally not offered here.
const MOCK_MEMBERS = [
  {
    address: '0x214d7C65b9C64f4Db9f2891D29c0a8cf7a5155b7',
    name: 'Topher',
    roles: [{ name: 'Manager', type: 'manager' }],
  },
  {
    address: '0xf85cD9a72F6Ee4B07A428bBCe9de9C9F0404ce3',
    name: 'Lakshmi',
    roles: [{ name: 'Manager', type: 'manager' }],
  },
  {
    address: '0x3aB2c1d8E9F47A5B6C0d1e2F3a4B5c6D7e8F9a0',
    name: 'Miguel',
    roles: [{ name: 'Member', type: 'member' }],
  },
]

const MOCK_ROLES = [
  { id: 'member-hat-id', label: 'Member', type: 'member' },
  { id: 'manager-hat-id', label: 'Manager', type: 'manager' },
]

// ─── Subcomponents ───────────────────────────────────────────────────────────

function RoleBadge({ name, type }: { name: string; type: string }) {
  if (type === 'admin') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-900/60 border border-purple-500/40 text-purple-200">
        <ShieldCheckIcon className="w-3 h-3" />
        {name}
      </span>
    )
  }
  if (type === 'manager') {
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

function MemberCard({
  member,
  onRemoveRole,
}: {
  member: typeof MOCK_MEMBERS[0]
  onRemoveRole: (address: string, role: string) => void
}) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-[#111827] border border-[#1e2a45] hover:bg-[#162035] transition-all duration-200">
      <div className="w-9 h-9 rounded-full bg-[#1a2545] border border-[#2a3a60] flex items-center justify-center flex-shrink-0 text-sm font-bold text-slate-300">
        {member.address.slice(2, 4).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-white truncate">{member.name}</p>
        <p className="text-xs text-slate-400 font-mono mt-0.5">
          {`${member.address.slice(0, 6)}...${member.address.slice(-4)}`}
        </p>
        {member.roles.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {member.roles.map((role) => (
              <div key={role.name} className="flex items-center gap-1">
                <RoleBadge name={role.name} type={role.type} />
                <button
                  onClick={() => onRemoveRole(member.address, role.name)}
                  className="p-0.5 text-slate-500 hover:text-red-400 transition-colors"
                  title="Remove role"
                >
                  <TrashIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Modal preview ───────────────────────────────────────────────────────────

function ManageTeamModalPreview({ onClose }: { onClose?: () => void }) {
  const [members, setMembers] = useState(MOCK_MEMBERS)
  const [selectedRole, setSelectedRole] = useState(MOCK_ROLES[0].id)
  const [address, setAddress] = useState('')
  const [hasQueuedTx, setHasQueuedTx] = useState(false)
  const [hasQueuedRemoval, setHasQueuedRemoval] = useState(false)

  const isValidAddress = /^0x[a-fA-F0-9]{40}$/.test(address)
  const selectedRoleMeta = MOCK_ROLES.find((r) => r.id === selectedRole)
  const isPrivileged = selectedRoleMeta?.type === 'manager'

  function handleRemoveRole(memberAddress: string, roleName: string) {
    const member = members.find((m) => m.address === memberAddress)
    const roleType = member?.roles.find((r) => r.name === roleName)?.type
    if (roleType === 'manager') {
      setHasQueuedRemoval(true)
    } else {
      setMembers((prev) =>
        prev.map((m) =>
          m.address === memberAddress
            ? { ...m, roles: m.roles.filter((r) => r.name !== roleName) }
            : m
        )
      )
    }
  }

  function handleAddMember(e: React.FormEvent) {
    e.preventDefault()
    if (!isValidAddress) return

    if (isPrivileged) {
      setHasQueuedTx(true)
    } else {
      const existing = members.find((m) => m.address === address)
      if (existing) {
        setMembers((prev) =>
          prev.map((m) =>
            m.address === address
              ? { ...m, roles: [...m.roles, { name: selectedRoleMeta!.label, type: selectedRoleMeta!.type }] }
              : m
          )
        )
      } else {
        setMembers((prev) => [
          ...prev,
          {
            address,
            name: 'New Member',
            roles: [{ name: selectedRoleMeta!.label, type: selectedRoleMeta!.type }],
          },
        ])
      }
      setAddress('')
    }
  }

  return (
    <div className="flex flex-col w-full md:w-[520px] bg-[#0a0f1e] rounded-2xl overflow-hidden shadow-2xl border border-[#1e2a45]">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-[#1e2a45] flex items-start justify-between gap-4">
        <div>
          <h2 className="font-GoodTimes text-xl text-white tracking-wide">Manage Team</h2>
          <p className="text-xs text-slate-400 mt-1">Add or remove roles for team members</p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 -mr-1 -mt-1 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Members list */}
      <div className="px-6 py-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Current Members
        </p>
        <div className="flex flex-col gap-2 max-h-[280px] overflow-y-auto pr-1">
          {members.length > 0 ? (
            members.map((m) => (
              <MemberCard key={m.address} member={m} onRemoveRole={handleRemoveRole} />
            ))
          ) : (
            <p className="text-sm text-slate-500 py-4 text-center">No members yet</p>
          )}
        </div>

        {hasQueuedRemoval && (
          <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-amber-900/20 border border-amber-500/30 text-amber-300 text-xs">
            <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              Removal queued.{' '}
              <span className="underline font-semibold cursor-pointer">Sign & execute in Safe</span>{' '}
              to finalize.
            </span>
          </div>
        )}
      </div>

      <div className="h-px bg-[#1e2a45] mx-6" />

      {/* Add member form */}
      <form className="px-6 py-5 flex flex-col gap-3" onSubmit={handleAddMember}>
        <div className="flex items-center gap-2">
          <UserPlusIcon className="w-4 h-4 text-slate-400" />
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Add a Member</p>
        </div>

        {/* Role selector */}
        <div className="relative w-full">
          <label className="block text-xs text-slate-500 mb-1 pl-1">Role</label>
          <select
            className="w-full px-4 py-2.5 bg-[#111827] border border-[#1e2a45] rounded-xl text-white text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-[#425eeb]/50 focus:border-[#425eeb]/60 transition-all"
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
          >
            {MOCK_ROLES.map((r) => (
              <option key={r.id} value={r.id} className="bg-[#0e1630] text-white">
                {r.label}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-3 bottom-2.5 text-slate-400">
            <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
              <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
            </svg>
          </div>
        </div>

        {/* Role context notice */}
        {isPrivileged ? (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-blue-900/20 border border-blue-500/25 text-blue-300 text-xs">
            <ShieldCheckIcon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>
              Managers get full administrative access. Granting this role requires
              Safe multisig approval after submission.
            </span>
          </div>
        ) : (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-[#0d1424] border border-[#1e2a45] text-slate-400 text-xs">
            <UserPlusIcon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>
              Members get standard access. To give someone admin-level control,
              assign the Manager role instead.
            </span>
          </div>
        )}

        {/* Address input */}
        <div>
          <label className="block text-xs text-slate-500 mb-1 pl-1">Wallet Address</label>
          <input
            className="w-full px-4 py-2.5 bg-[#111827] border border-[#1e2a45] rounded-xl text-white text-sm font-mono placeholder:text-slate-600 placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-[#425eeb]/50 focus:border-[#425eeb]/60 transition-all"
            placeholder="0x..."
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={!isValidAddress}
          className={`w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 ${
            isValidAddress
              ? 'cursor-pointer hover:opacity-90'
              : 'opacity-40 cursor-not-allowed'
          }`}
          style={{ background: 'linear-gradient(90deg, #425eeb 5%, #6d3f79 90%)' }}
        >
          {isPrivileged ? 'Queue Safe Transaction' : 'Add Member'}
        </button>

        {hasQueuedTx && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-green-900/20 border border-green-500/30 text-green-300 text-xs">
            <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              Transaction queued.{' '}
              <span className="underline font-semibold cursor-pointer">Sign & execute in Safe</span>{' '}
              to complete.
            </span>
          </div>
        )}
      </form>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DevManageTeamPage() {
  const [showModal, setShowModal] = useState(false)

  return (
    <div className="min-h-screen bg-[#060b1a] text-white">
      {/* Dev badge */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 py-1 bg-yellow-500/20 border-b border-yellow-500/30 text-yellow-400 text-xs font-semibold">
        <span>⚠ DEV PREVIEW — not visible in production</span>
      </div>

      <div className="max-w-4xl mx-auto px-6 pt-32 pb-20">
        <div className="mb-10">
          <h1 className="font-GoodTimes text-3xl text-white mb-2">Manage Team — UI Preview</h1>
          <p className="text-slate-400 text-sm">
            Inline preview of the Manage Team modal. Interactions use mock data only.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          {/* Inline panel (always visible) */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
              Inline panel
            </p>
            <ManageTeamModalPreview />
          </div>

          {/* Overlay trigger */}
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
                Overlay modal (how it appears in production)
              </p>
              <button
                onClick={() => setShowModal(true)}
                className="px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:opacity-90"
                style={{ background: 'linear-gradient(90deg, #425eeb 5%, #6d3f79 90%)' }}
              >
                Open Manage Team Modal
              </button>
            </div>

            <div className="p-5 rounded-xl bg-[#0d1424] border border-[#1e2a45] text-sm text-slate-300 space-y-2">
              <p className="font-semibold text-white text-xs uppercase tracking-wider mb-3">What to test</p>
              <ul className="space-y-1.5 text-xs text-slate-400 list-disc list-inside">
                <li>Select <strong className="text-slate-200">Manager</strong> role → Safe-approval notice (admin-level access)</li>
                <li>Select <strong className="text-slate-200">Member</strong> role → standard-access notice, minted directly</li>
                <li>Enter a valid <code className="text-slate-300">0x...</code> address → button activates</li>
                <li>Add a <strong className="text-slate-200">Member</strong> → appears instantly in the list (mock)</li>
                <li>Add a <strong className="text-slate-200">Manager</strong> → shows "queued for Safe" banner</li>
                <li>Click the trash icon next to a role badge to remove it</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Overlay modal */}
      {showModal && (
        <div
          className="fixed inset-0 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto px-4"
          style={{ zIndex: 10000 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false)
          }}
        >
          <div
            className="relative"
            style={{ marginTop: 80, marginBottom: 40 }}
          >
            <ManageTeamModalPreview onClose={() => setShowModal(false)} />
          </div>
        </div>
      )}
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async () => {
  if (process.env.NODE_ENV !== 'development') {
    return { notFound: true }
  }
  return { props: {} }
}
