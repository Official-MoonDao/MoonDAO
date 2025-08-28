import React from 'react'
import Frame from '@/components/layout/Frame'
import Modal from '@/components/layout/Modal'

type ChartModalProps = {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  chartComponent: React.ReactNode
  chartTitle: string
}

export default function ChartModal({
  isOpen,
  setIsOpen,
  chartComponent,
  chartTitle,
}: ChartModalProps) {
  if (!isOpen) return null

  return (
    <Modal id="chart-modal" setEnabled={setIsOpen}>
      <Frame
        noPadding
        bottomLeft="20px"
        bottomRight="20px"
        topRight="0px"
        topLeft="10px"
      >
        <div className="bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 p-4 md:p-6 w-[95vw] md:min-w-[800px] max-w-[95vw] md:max-w-[90vw]">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-GoodTimes text-white">{chartTitle}</h2>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/60 hover:text-white text-2xl transition-colors duration-200"
              aria-label="Close modal"
            >
              ×
            </button>
          </div>
          <div className="w-full">{chartComponent}</div>
        </div>
      </Frame>
    </Modal>
  )
}
