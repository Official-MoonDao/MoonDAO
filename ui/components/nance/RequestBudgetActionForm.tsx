import { PlusCircleIcon } from '@heroicons/react/20/solid'
import { XMarkIcon } from '@heroicons/react/24/solid'
import { MOONEY_ADDRESSES } from 'const/config'
import { useFieldArray, useFormContext } from 'react-hook-form'
import StandardButton from '../layout/StandardButton'
import SafeTokenForm from './form/SafeTokenForm'
import StringForm from './form/StringForm'

export default function RequestBudgetActionForm({ disableRequiredFields = false }) {
  // form

  const { control } = useFormContext()

  const {
    fields: budgetFields,
    append: budgetAppend,
    remove: budgetRemove,
  } = useFieldArray({
    control,
    name: 'budget',
  })

  // DEBUG
  // const watchAllFields = watch()
  // useEffect(() => {
  //   console.log('Form values:', watchAllFields)
  // }, [watchAllFields])

  return (
    <div>
      <div className="space-y-12">
        <div className="pb-10">
          <h2 className="text-base font-semibold font-GoodTimes leading-7 text-white">Budget</h2>
          <p className="mt-1 text-sm leading-6 text-gray-400">
            Tokens will be sent to the newly created multisig.
          </p>

          {budgetFields.map((field, index) => (
            <div key={field.id} className="mt-5 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-8">
              <div className="sm:col-span-2">
                <StringForm
                  label="Amount"
                  fieldName={`budget.${index}.amount`}
                  required={!disableRequiredFields}
                />
              </div>

              <div className="sm:col-span-3">
                <SafeTokenForm
                  address="0xce4a1E86a5c47CD677338f53DA22A91d85cab2c9"
                  fieldName={`budget.${index}.token`}
                  acceptedTokens={['ETH', 'USDC', 'USDT', 'DAI', 'MOONEY', 'SAFE', 'WBTC', 'MATIC']}
                />
              </div>

              <div className="sm:col-span-2">
                <StringForm
                  label="Justification"
                  fieldName={`budget.${index}.justification`}
                  required={!disableRequiredFields}
                />
              </div>

              <div className="sm:col-span-1 flex items-center">
                <button
                  className="mt-10 btn btn-circle btn-outline btn-sm hover:text-black"
                  type="button"
                  onClick={() => budgetRemove(index)}
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}

          <StandardButton
            className="mt-8 gradient-2 rounded-full"
            onClick={() =>
              budgetAppend({
                token: '',
                amount: '',
                justification: 'flex',
              })
            }
          >
            <div className="flex items-center gap-2">
              <PlusCircleIcon className="w-6 h-6" />
              Add budget item
            </div>
          </StandardButton>
        </div>
      </div>
    </div>
  )
}
