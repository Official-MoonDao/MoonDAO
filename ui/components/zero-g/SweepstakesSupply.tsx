export default function SweepstakesSupply({ supply }: any) {
  return (
    <div className="w-full rounded-2xl pt-4 backdropBlur ">
      <div className="w-full flex justify-end gap-[30%]">
        <p className="italic">
          <span className="text-n3blue">{supply + '/162'} </span>tickets have
          been claimed!
        </p>
      </div>
    </div>
  )
}
