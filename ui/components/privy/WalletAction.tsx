export default function WalletAction({ id, label, icon, onClick }: any) {
  return (
    <div
      id={id}
      className="flex flex-col justify-start items-center w-[40px] h-[40px]"
    >
      <button
        className="w-[35px] h-[35px] flex justify-center items-center gradient-2 p-1 pr-2 pl-2 rounded-full"
        onClick={onClick}
      >
        {icon}
      </button>
      <p className="mt-1 text-xs text-center">{label}</p>
    </div>
  )
}
