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
        className="w-full rounded-md wysiwyg-bg px-4 pb-2 text-white text-xl font-bold"
        placeholder="Proposal Title"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
  )
}
