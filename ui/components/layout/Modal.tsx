import { createPortal } from 'react-dom'

type ModalProps = {
  id: string
  setEnabled: Function
  children: any
}

function Portal({ children }: { children: React.ReactNode }) {
  if (typeof document === 'undefined') return null // SSR check
  return createPortal(children, document.body)
}

export default function Modal({ id, setEnabled, children }: ModalProps) {
  return (
    <Portal>
      <div
        onMouseDown={(e: any) => {
          e.stopPropagation()
          if (e.target.id === id) setEnabled(false)
        }}
        id={id}
        className="fixed top-0 left-0 w-screen h-screen bg-[#00000080] backdrop-blur-sm flex justify-center items-start z-[9999] overflow-auto bg-gradient-to-t from-[#3F3FA690] via-[#00000080] to-transparent animate-fadeIn"
      >
        <div className="mt-12 pb-12">{children}</div>
      </div>
    </Portal>
  )
}
