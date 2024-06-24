import { ErrorMessage } from '@hookform/error-message'
import { useFormContext } from 'react-hook-form'

export default function StringForm({
  label,
  fieldName,
  defaultValue = '',
}: {
  label: string
  fieldName: any
  defaultValue?: string
}) {
  const {
    register,
    formState: { errors },
  } = useFormContext()

  return (
    <div>
      <label className="label">
        <span className="label-text">{label}</span>
      </label>
      <div className="mt-1 flex rounded-md shadow-sm">
        <input
          type="text"
          {...register(fieldName, { shouldUnregister: true })}
          className="block h-10 w-full input dark:bg-black flex-1 rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
      </div>
      <ErrorMessage
        errors={errors}
        name={fieldName}
        render={({ message }) => <p className="text-red-500 mt-1">{message}</p>}
      />
    </div>
  )
}
