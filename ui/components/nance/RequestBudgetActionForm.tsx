import { XMarkIcon, PlusIcon } from '@heroicons/react/24/solid'
import {
  FormProvider,
  SubmitHandler,
  useFieldArray,
  useForm,
} from 'react-hook-form'
import AddressForm from './form/AddressForm'
import DiscordUserIdForm from './form/DiscordUserIdForm'

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
    flex: {
      token: string
      amount: string
    }
    justification: {
      token: string
      amount: string
    }
  }
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

            <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <div className="sm:col-span-3 sm:col-start-1">
                <label
                  htmlFor="discordUsername"
                  className="block text-sm font-medium leading-6 text-white"
                >
                  Amount
                </label>
                <div className="mt-2">
                  <input
                    type="text"
                    name="discordUsername"
                    id="discordUsername"
                    className="block w-full rounded-md border-0 bg-white/5 py-1.5 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
                  />
                </div>
              </div>

              <div className="sm:col-span-3">
                <label
                  htmlFor="address"
                  className="block text-sm font-medium leading-6 text-white"
                >
                  Token
                </label>
                <div className="mt-2">
                  <input
                    type="text"
                    name="payoutAddress"
                    id="payoutAddress"
                    className="block w-full rounded-md border-0 bg-white/5 py-1.5 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </FormProvider>
  )
}
