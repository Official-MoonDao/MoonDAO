import { XMarkIcon, PlusIcon } from '@heroicons/react/24/solid'
import {
  FormProvider,
  SubmitHandler,
  useFieldArray,
  useForm,
} from 'react-hook-form'
import AddressForm from './form/AddressForm'
import DiscordUserIdForm from './form/DiscordUserIdForm'
import SafeTokenForm from './form/SafeTokenForm'

interface RequestBudgetAction {
  projectTeam: {
    discordUserId: string
    payoutAddress: string
    votingAddress: string
    isRocketeer: boolean
  }[]
  multisigTeam: {
    discordUserId: string
    address: string
  }[]
  budget: {
    token: string
    amount: string
    // justification is the reason/memo
    justification: string
  }[]
}

export default function RequestBudgetActionForm() {
  // form
  const methods = useForm<RequestBudgetAction>({
    mode: 'onBlur',
    defaultValues: {
      projectTeam: [
        {
          discordUserId: '',
          payoutAddress: '',
          votingAddress: '',
          isRocketeer: true,
        },
        {
          discordUserId: '',
          payoutAddress: '',
          votingAddress: '',
          isRocketeer: false,
        },
      ],
      multisigTeam: [
        {
          discordUserId: '',
          address: '',
        },
        {
          discordUserId: '',
          address: '',
        },
        {
          discordUserId: '',
          address: '',
        },
        {
          discordUserId: '',
          address: '',
        },
        {
          discordUserId: '',
          address: '',
        },
      ],
      budget: [
        { token: '', amount: '', justification: 'dev cost' },
        { token: '', amount: '', justification: 'flex' },
      ],
    },
  })
  const { register, handleSubmit, control, formState, getValues, setValue } =
    methods

  const {
    fields: projectTeamFields,
    append: projectTeamAppend,
    remove: projectTeamRemove,
  } = useFieldArray({
    control,
    name: 'projectTeam',
  })
  const {
    fields: multisigTeamFields,
    append: multisigTeamAppend,
    remove: multisigTeamRemove,
  } = useFieldArray({
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

  const onSubmit: SubmitHandler<RequestBudgetAction> = async (formData) => {
    console.debug('RequestBudget.submit', formData)
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)}>
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
                    onClick={() => projectTeamRemove(index)}
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}

            <button
              className="btn gap-2 mt-4"
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
                className="mt-5 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-5"
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

                <div className="sm:col-span-1 flex items-center">
                  <button
                    className="btn btn-circle btn-outline btn-sm"
                    onClick={() => multisigTeamRemove(index)}
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}

            <button
              className="btn gap-2 mt-4"
              onClick={() =>
                multisigTeamAppend({
                  discordUserId: '',
                  address: '',
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
              Budget
            </h2>
            <p className="mt-1 text-sm leading-6 text-gray-400">
              Tokens will be sent to the newly created multisig.
            </p>

            {budgetFields.map((field, index) => (
              <div
                key={field.id}
                className="mt-5 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-5"
              >
                <div className="sm:col-span-2">
                  <SafeTokenForm
                    address="0xce4a1E86a5c47CD677338f53DA22A91d85cab2c9"
                    fieldName={`budget.${index}.token`}
                  />
                </div>

                <div className="sm:col-span-1 flex items-center">
                  <button
                    className="btn btn-circle btn-outline btn-sm"
                    onClick={() => budgetRemove(index)}
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}

            <button
              className="btn gap-2 mt-4"
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
      </form>
    </FormProvider>
  )
}
