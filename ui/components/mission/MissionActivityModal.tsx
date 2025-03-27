import { XMarkIcon } from '@heroicons/react/20/solid'
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import Modal from '../layout/Modal'

function DownloadButton({
  onClick,
  children,
}: {
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      className="w-full items-center justify-center gradient-2 flex gap-2 px-4 py-2 rounded-xl"
      onClick={onClick}
    >
      <ArrowDownTrayIcon className="w-5 h-5" />
      <p>{children}</p>
    </button>
  )
}

export default function MissionActivityModal({ setEnabled }: any) {
  return (
    <Modal id="mission-pay-modal" setEnabled={setEnabled}>
      <div className="mt-12 w-screen h-full rounded-[2vmax] max-w-[500px] flex flex-col gap-4 items-start justify-start p-5 bg-gradient-to-b from-dark-cool to-darkest-cool">
        <div className="w-full flex gap-4 items-start justify-between">
          <h3 className="text- font-GoodTimes">{`Download mission activity CSVs`}</h3>
          <button
            type="button"
            className="flex h-10 w-10 border-2 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
            onClick={() => setEnabled(false)}
          >
            <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
          </button>
        </div>
        <div className="w-full flex flex-col gap-2 items-start justify-between">
          <p>Block number</p>
          <div className="w-full border-[1px] border-light-warm rounded-xl p-2 flex gap-2 items-center justify-between">
            <p>{(1234567890).toLocaleString()}</p>
            <p>latest</p>
          </div>
        </div>
        <div className="w-full flex flex-col gap-2 items-center justify-center">
          <DownloadButton
            onClick={() => {
              console.log('download')
            }}
          >
            {'Token Holders'}
          </DownloadButton>
          <DownloadButton
            onClick={() => {
              console.log('download')
            }}
          >
            {'Payouts'}
          </DownloadButton>
          <DownloadButton
            onClick={() => {
              console.log('download')
            }}
          >
            {'Payments'}
          </DownloadButton>
          <DownloadButton
            onClick={() => {
              console.log('download')
            }}
          >
            {'Redemptions'}
          </DownloadButton>
          <DownloadButton
            onClick={() => {
              console.log('download')
            }}
          >
            {'ETH Transfers'}
          </DownloadButton>
        </div>
      </div>
    </Modal>
  )
}
