type FormInputProps = {
  placeholder: string
  value: string | number | undefined
  onChange: any
  type?: string
  className?: string
}

export default function FormInput({
  type = 'text',
  placeholder,
  value,
  onChange,
  className = '',
}: FormInputProps) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      className={`w-full p-2 border-2 dark:border-0 dark:bg-[#0f152f] rounded-sm ${className}`}
      onChange={onChange}
      value={value}
    />
  )
}
