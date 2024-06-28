type ModalProps = {
  id: string
  setEnabled: Function
  children: any
}

export default function Modal({ id, setEnabled, children }: ModalProps) {
  return (
    <div
      onMouseDown={(e: any) => {
        if (e.target.id === id) setEnabled(false)
      }}
      id={id}
      className="fixed top-0 left-0 w-screen h-screen bg-[#00000080] backdrop-blur-sm flex justify-center items-center z-[1000]"
    >
      {children}
    </div>
  )
}
