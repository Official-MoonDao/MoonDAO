
export const TITLE_ID = 'proposal-title'

export default function ProposalTitleInput({
  initialValue,
}: {
  initialValue?: string
}) {
  return (
      <input
        type="text"
        className="w-full mb-2 rounded-md border border-gray-600 bg-black px-4 py-2 text-white text-xl font-bold"
        placeholder="Proposal Title"
        id={TITLE_ID}
        defaultValue={initialValue}
      />
  )
}
