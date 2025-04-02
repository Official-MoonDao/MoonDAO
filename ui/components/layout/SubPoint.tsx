export default function SubPoint({ point }: { point: string }) {
  return (
    <div className="text-sm ml-10 mb-2">
      <span className="font-bold">●</span> {point}
    </div>
  )
}
