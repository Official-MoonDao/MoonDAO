import toast from 'react-hot-toast'

type AddressProps = {
  address: string | undefined
  className?: string
}

export default function Address({ address, className }: AddressProps) {
  return (
    <button
      className={`flex items-center gap-4 text-2xl font-GoodTimes hover:font-bold ${className}`}
      onClick={() => {
        if (address) {
          navigator.clipboard.writeText(address)
          toast.success('Copied to clipboard.')
        }
      }}
    >
      {address && `${address?.slice(0, 6)}...${address?.slice(-4)}`}
    </button>
  )
}
