export default function InputContainer({ children }: any) {
  return (
    <div className="flex flex-col justify-center items-center p-5 rounded-sm border-style backdropBlur">
      {children}
    </div>
  )
}
