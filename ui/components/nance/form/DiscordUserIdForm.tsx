import { ErrorMessage } from '@hookform/error-message'
import { useEffect } from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import DiscordUserIdInput from './DiscordUserIdInput'

interface AddressFormProps {
  /**
   * The label for the input
   */
  label: string
  /**
   * The name of the field in the form
   */
  fieldName: any
  /**
   * The default value for the input
   */
  defaultValue?: string
  /**
   * Whether to show the type as "address" in front of the input.
   */
  showType?: boolean
  /**
   * Whether the field is required
   */
  required?: boolean
}

// TODO: support to load from default value of form
export default function DiscordUserIdForm({
  label,
  fieldName,
  defaultValue = '',
  required = true,
}: AddressFormProps) {
  const {
    control,
    formState: { errors, isValidating },
    setValue,
    getValues
  } = useFormContext()

  // Controller doesn't support default values, so we need to set it manually
  // Here's the trick: we only set the default value if the field is empty
  useEffect(() => {
    if (defaultValue && !getValues(fieldName)) {
      setValue(fieldName, defaultValue)
    }
  }, [defaultValue, getValues, setValue, fieldName])

  const superFieldName = fieldName.split('.').slice(0, 2).join('.');
  const discordUserNameField = `${superFieldName}.discordUsername`;
  const discordUsername = getValues(discordUserNameField)

  return (
    <div>
      <label className="label">
        <span className="label-text">{label}</span>
      </label>
      <div className="mt-1 flex rounded-md shadow-sm">
        <Controller
          name={fieldName}
          control={control}
          rules={{
            required: required && "Can't be empty",
          }}
          render={({ field: { value } }) => (
            <DiscordUserIdInput val={value} displayVal={discordUsername} setVal={(v) => {
              setValue(discordUserNameField, v?.global_name)
              setValue(fieldName, v?.id)
            }} />
          )}
          shouldUnregister={true}
        />
      </div>

      {!isValidating && (
        <ErrorMessage
          errors={errors}
          name={fieldName}
          render={({ message }) => (
            <p className="mt-1 text-red-500">{message}</p>
          )}
        />
      )}
    </div>
  )
}
