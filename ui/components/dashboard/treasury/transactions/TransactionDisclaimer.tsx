import { Disclosure } from '@headlessui/react'
import { MinusSmallIcon, PlusSmallIcon } from '@heroicons/react/24/outline'

const TransactionDisclaimer = () => {
  return (
    <div className="my-6 w-[336px] sm:w-[400px] 2xl:w-full px-4">
      <Disclosure as="div" className="pt-6">
        {({ open }) => (
          <>
            <dt>
              <Disclosure.Button className="flex w-full items-center justify-between text-left text-white">
                <h6 className="text-lg lg:text-xl underline opacity-90 hover:opacity-100 underline-offset-2 font-semibold tracking-wide text-stronger-light dark:text-moon-gold transition-all duration-150 hover:scale-105">
                  Why are some transactions flagged?
                </h6>
                <span className="ml-3 flex h-7 items-center text-stronger-light dark:text-moon-gold">
                  {open ? (
                    <MinusSmallIcon
                      className="h-6 w-6 lg:h-7 lg:w-7"
                      aria-hidden="true"
                    />
                  ) : (
                    <PlusSmallIcon
                      className="h-6 w-6 lg:h-7 lg:w-7"
                      aria-hidden="true"
                    />
                  )}
                </span>
              </Disclosure.Button>
            </dt>
            <Disclosure.Panel as="dd" className="mt-4 lg:mt-6">
              <p className="text-sm font-semibold lg:text-base leading-7 tracking-wide text-red-500 uppercase">
                We flag transactions that are suspicious. Your funds can be at
                risk if you interact with those tokens.
              </p>
              <p className="mt-2 text-sm lg:text-base leading-7 tracking-wide text-slate-900 dark:text-slate-100 opacity-90">
                Like many other web3 Organizations & DAOs, MoonDAO gets
                targetted by scammers. They use the tactic of sending tokens
                that can drain a wallet if it's owner interacts with them.
              </p>
            </Disclosure.Panel>
          </>
        )}
      </Disclosure>
    </div>
  )
}

export default TransactionDisclaimer
