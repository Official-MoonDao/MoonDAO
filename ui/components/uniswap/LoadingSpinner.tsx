export default function LoadingSpinner() {
  return (
    <div className="flex justify-center items-center">
      <div className="w-4 h-4 border-4 border-purple-500 rounded-full animate-spin">
        <div className="w-4 h-4 border-4 border-purple-500 rounded-full animate-spin"></div>
      </div>
    </div>
  )
}
