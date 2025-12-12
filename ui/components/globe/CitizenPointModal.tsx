import { XMarkIcon } from '@heroicons/react/24/outline'
import Image from 'next/image'
import Link from 'next/link'
import { generatePrettyLinkWithId } from '@/lib/subscription/pretty-links'
import Modal from '../layout/Modal'

type CitizenPointModalProps = {
  selectedPoint: any
  setEnabled: (enabled: boolean) => void
}

export default function CitizenPointModal({ selectedPoint, setEnabled }: CitizenPointModalProps) {
  return (
    <Modal
      id="point-modal"
      setEnabled={setEnabled}
      showCloseButton={false}
      className="fixed top-0 left-0 w-screen h-screen bg-[#00000080] backdrop-blur-sm flex justify-center items-center z-[9999] overflow-auto bg-gradient-to-t from-[#3F3FA690] via-[#00000080] to-transparent animate-fadeIn p-4"
    >
      <div className="w-[90vw] max-w-[700px] rounded-2xl flex flex-col gap-5 bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-xl border-2 border-white/20 shadow-2xl p-6 md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h2 className="font-GoodTimes text-white text-base md:text-xl leading-tight">
              {selectedPoint?.formattedAddress}
            </h2>
            <p className="text-white/60 text-sm mt-2">
              {selectedPoint?.citizens?.length}{' '}
              {selectedPoint?.citizens?.length === 1 ? 'Citizen' : 'Citizens'}
            </p>
          </div>

          <button
            id="close-modal"
            type="button"
            className="flex h-10 w-10 border-2 border-white/30 hover:border-white/60 hover:bg-white/10 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-white/50 transition-all hover:scale-105 flex-shrink-0"
            onClick={() => setEnabled(false)}
          >
            <XMarkIcon className="h-5 w-5 text-white" aria-hidden="true" />
          </button>
        </div>

        <div className="w-full bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-5 overflow-hidden">
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 md:gap-8 max-h-[50vh] md:max-h-[60vh] overflow-y-auto overflow-x-hidden pr-2 py-2">
            {selectedPoint?.citizens.map((c: any) => (
              <Link
                className="group"
                href={`/citizen/${generatePrettyLinkWithId(c.name, c.id)}`}
                key={c.id}
                passHref
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="relative rounded-full overflow-hidden border-2 border-white/20 group-hover:border-moon-gold transition-all duration-300 group-hover:scale-105 group-hover:shadow-lg group-hover:shadow-moon-gold/30">
                    <Image
                      className="rounded-full"
                      src={`https://ipfs.io/ipfs/${c.image.split('ipfs://')[1]}`}
                      alt={c.name}
                      width={80}
                      height={80}
                    />
                  </div>
                  <p className="w-full text-center break-words text-xs text-white/80 group-hover:text-white transition-colors line-clamp-2">
                    {c.name}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}
