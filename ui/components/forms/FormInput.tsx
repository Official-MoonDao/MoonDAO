type FormInputProps = {
  value: string | number | undefined
  onChange: any
  placeholder?: string
  label?: string
  type?: string
  className?: string
}

export default function FormInput({
  type = 'text',
  placeholder,
  value,
  onChange,
  className = '',
  label,
}: FormInputProps) {
  return (
    <>
      {label && <p className="text-sm font-GoodTimes">{label}</p>}
      <input
        type={type}
        placeholder={placeholder}
        className={`w-full p-2 border-2 dark:border-0 dark:bg-[#0f152f] rounded-sm ${className}`}
        onChange={onChange}
        value={value}
      />
    </>
  )
}
