type FormTextAreaProps = {
  id?: string
  value: string | undefined
  onChange: any
  placeholder?: string
  label?: string
  className?: string
  disabled?: boolean
  rows?: number
}

export default function FormTextArea({
  id,
  placeholder,
  value,
  onChange,
  className = '',
  label,
  disabled = false,
  rows = 3,
}: FormTextAreaProps) {
  return (
    <>
      {label && <p className="text-sm font-GoodTimes">{label}</p>}
      <textarea
        id={id}
        placeholder={placeholder}
        className={`w-full p-2 border-2 dark:border-0 dark:bg-[#0f152f] rounded-sm ${className}`}
        onChange={onChange}
        value={value}
        disabled={disabled}
        rows={rows}
      />
    </>
  )
}
