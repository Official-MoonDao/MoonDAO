import { XMarkIcon, PlusIcon } from '@heroicons/react/24/solid'
import { useFieldArray, useFormContext } from 'react-hook-form'
import AddressForm from './form/AddressForm'
import DiscordUserIdForm from './form/DiscordUserIdForm'
import SafeTokenForm from './form/SafeTokenForm'
import StringForm from './form/StringForm'

export default function RequestBudgetActionForm() {
  // form

  const { register, control } = useFormContext()

  const {
    fields: projectTeamFields,
    append: projectTeamAppend,
    remove: projectTeamRemove,
  } = useFieldArray({
    control,
    name: 'projectTeam',
  })
  const { fields: multisigTeamFields } = useFieldArray({
    control,
    name: 'multisigTeam',
  })
  const {
    fields: budgetFields,
    append: budgetAppend,
    remove: budgetRemove,
  } = useFieldArray({
    control,
    name: 'budget',
  })

  return (
    <div>
      <div className="space-y-12">
        <div className="border-b border-white/10 pb-12">
          <h2 className="text-base font-semibold leading-7 text-white">
            Project team
          </h2>
          {/* <p className="mt-1 text-sm leading-6 text-gray-400">
            Use a permanent address where you can receive mail.
          </p> */}

          {projectTeamFields.map((field, index) => (
            <div
              key={field.id}
              className="mt-5 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-8"
            >
              <div className="sm:col-span-2 sm:col-start-1">
                <DiscordUserIdForm
                  label="Discord Username"
                  fieldName={`projectTeam.${index}.discordUserId`}
                />
              </div>

              <div className="sm:col-span-2">
                <AddressForm
                  label="Payout Address"
                  fieldName={`projectTeam.${index}.payoutAddress`}
                />
              </div>

              <div className="sm:col-span-2">
                <AddressForm
                  label="Voting Address"
                  fieldName={`projectTeam.${index}.votingAddress`}
                />
              </div>

              <div className="sm:col-span-1 flex items-center">
                <div className="w-full">
                  <label className="label">
                    <span className="label-text">Rocketeer?</span>
                  </label>
                  <input
                    type="checkbox"
                    className="h-8 w-8"
                    {...register(`projectTeam.${index}.isRocketeer`, {
                      shouldUnregister: true,
                    })}
                  />
                </div>
              </div>

              <div className="sm:col-span-1 flex items-center">
                <button
                  className="btn btn-circle btn-outline btn-sm"
                  type="button"
                  onClick={() => projectTeamRemove(index)}
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}

          <button
            className="btn gap-2 mt-4"
            type="button"
            onClick={() =>
              projectTeamAppend({
                discordUserId: '',
                payoutAddress: '',
                votingAddress: '',
                isRocketeer: false,
              })
            }
          >
            <PlusIcon className="w-5 h-5" />
            Add member
          </button>
        </div>
      </div>

      <div className="space-y-12">
        <div className="border-b border-white/10 pb-12">
          <h2 className="text-base font-semibold leading-7 text-white">
            Multisig Team
          </h2>
          <p className="mt-1 text-sm leading-6 text-gray-400">
            A 3/5 Safe account will be created upon approval.
          </p>

          {multisigTeamFields.map((field, index) => (
            <div
              key={field.id}
              className="mt-5 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-4"
            >
              <div className="sm:col-span-2 sm:col-start-1">
                <DiscordUserIdForm
                  label="Discord Username"
                  fieldName={`multisigTeam.${index}.discordUserId`}
                />
              </div>

              <div className="sm:col-span-2">
                <AddressForm
                  label="Address"
                  fieldName={`multisigTeam.${index}.address`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-12">
        <div className="border-b border-white/10 pb-12">
          <h2 className="text-base font-semibold leading-7 text-white">
            Budget
          </h2>
          <p className="mt-1 text-sm leading-6 text-gray-400">
            Tokens will be sent to the newly created multisig.
          </p>

          {budgetFields.map((field, index) => (
            <div
              key={field.id}
              className="mt-5 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-8"
            >
              <div className="sm:col-span-2">
                <StringForm
                  label="Amount"
                  fieldName={`budget.${index}.amount`}
                />
              </div>

              <div className="sm:col-span-3">
                <SafeTokenForm
                  address="0xce4a1E86a5c47CD677338f53DA22A91d85cab2c9"
                  fieldName={`budget.${index}.token`}
                />
              </div>

              <div className="sm:col-span-2">
                <StringForm
                  label="Justification"
                  fieldName={`budget.${index}.justification`}
                />
              </div>

              <div className="sm:col-span-1 flex items-center">
                <button
                  className="btn btn-circle btn-outline btn-sm"
                  type="button"
                  onClick={() => budgetRemove(index)}
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}

          <button
            className="btn gap-2 mt-4"
            type="button"
            onClick={() =>
              budgetAppend({
                token: '',
                amount: '',
                justification: 'flex',
              })
            }
          >
            <PlusIcon className="w-5 h-5" />
            Add budget
          </button>
        </div>
      </div>
    </div>
  )
}
