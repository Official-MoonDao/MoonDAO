export default function ProposalTitleInput({
  value,
  onChange
}: {
  value: string | undefined,
  onChange: (s: string) => void
}) {
  return (
      <input
        type="text"
        className="w-full rounded-xl bg-black/30 border border-white/20 px-6 py-4 text-white text-xl font-bold placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200 hover:border-white/30"
        placeholder="Proposal Title"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
  )
}
