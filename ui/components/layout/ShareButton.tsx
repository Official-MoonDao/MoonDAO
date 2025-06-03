import { ShareIcon } from '@heroicons/react/20/solid'
import toast from 'react-hot-toast'

export default function ShareButton({ link }: any) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        navigator.clipboard.writeText(link)
        toast.success('Link copied to clipboard.')
      }}
    >
      <ShareIcon className="h-8 w-8 p-2 gradient-2 hover:text-light-cool rounded-lg" />
    </button>
  )
}
