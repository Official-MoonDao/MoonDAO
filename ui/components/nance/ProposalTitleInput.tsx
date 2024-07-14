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
        className="w-full mb-2 rounded-md border border-gray-600 bg-black px-4 py-2 text-white text-xl font-bold"
        placeholder="Proposal Title"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
  )
}
