import { XMarkIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import Modal from '../layout/Modal'

export default function CitizenPointModal({ selectedPoint, setEnabled }: any) {
  return (
    <Modal id="point-modal" setEnabled={setEnabled}>
      <div className="w-full rounded-[2vmax] flex flex-col gap-2 items-start justify-start w-auto md:w-[500px] p-5  bg-dark-cool h-screen md:h-auto">
        <div className="w-full flex items-center justify-between">
          <div>
            <h2 className="font-GoodTimes max-w-[200px] md:max-w-none">
              {selectedPoint?.formattedAddress}
            </h2>
          </div>

          <button
            type="button"
            className="flex h-10 w-10 border-2 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
            onClick={() => setEnabled(false)}
          >
            <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
          </button>
        </div>
        <div className="p-2 grid grid-cols-3 md:grid-cols-5 gap-4 overflow-y-scroll max-h-[80vh]">
          {selectedPoint?.citizens.map((c: any) => (
            <Link
              className="hover:underline hover:scale-105 transition-all duration-300"
              href={`/citizen/${c.id}`}
              key={c.id}
              passHref
            >
              <div className="flex flex-col items-center">
                <img
                  className="rounded-full"
                  src={c.image}
                  alt={c.name}
                  width={75}
                  height={75}
                />
                <p className="w-[75px] text-center break-words">{c.name}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </Modal>
  )
}
