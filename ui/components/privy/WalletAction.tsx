export default function WalletAction({ id, label, icon, onClick }: any) {
  return (
    <div
      id={id}
      className="flex flex-col items-center"
    >
      <button
        className="w-10 h-10 md:w-12 md:h-12 flex justify-center items-center bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg mb-2 group"
        onClick={onClick}
      >
        <div className="text-white group-hover:scale-110 transition-transform duration-200">
          {icon}
        </div>
      </button>
      <p className="text-[10px] md:text-xs text-center text-gray-300 font-medium leading-tight">{label}</p>
    </div>
  )
}
