import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { NavLink } from '../NavLink'
import { Fragment } from 'react'
import { useEffect } from 'react'
import { useSwipeDirection } from '../../../lib/utils/hooks/useSwipeDirection'
import { LogoSidebar, LogoSidebarLight } from '../../assets'
import NavigationLink from './NavigationLink'

const MobileSidebar = ({
  navigation,
  lightMode,
  sidebarOpen,
  setSidebarOpen,
  isFullscreen,
}: any) => {
  //close sidebar when swiping left
  const swipeDirection = useSwipeDirection()
  useEffect(() => {
    if (sidebarOpen && swipeDirection === 'left') {
      setSidebarOpen(false)
    }
  }, [swipeDirection, sidebarOpen, setSidebarOpen])

  return (
    <Transition.Root show={sidebarOpen} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-[10000]"
        onClose={setSidebarOpen}
      >
        <Transition.Child
          as={Fragment}
          enter="transition-opacity ease-linear duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition-opacity ease-linear duration-300"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 z-[10001] flex w-[320px]">
          <Transition.Child
            as={Fragment}
            enter="transition ease-in-out duration-300 transform"
            enterFrom="-translate-x-full"
            enterTo="translate-x-0"
            leave="transition ease-in-out duration-300 transform"
            leaveFrom="translate-x-0"
            leaveTo="-translate-x-full"
          >
            {/*The actual menu inside */}
            <Dialog.Panel
              className="relative flex w-full max-w-xs flex-1 flex-col px-3 pb-4 pt-5 backdrop-blur-xl"
              style={{
                background: 'linear-gradient(180deg, rgba(5,5,8,0.98) 0%, rgba(10,15,18,0.98) 50%, rgba(5,5,5,0.98) 100%)',
                borderRight: '1px solid rgba(0, 255, 200, 0.2)',
                boxShadow: '2px 0 20px rgba(0, 255, 200, 0.08)',
              }}
            >
              <div className="absolute right-0 top-0 -mr-12 pt-2">
                <button
                  type="button"
                  className="ml-1 flex h-10 w-10 items-center justify-center bg-[#050508]/90 backdrop-blur-md transition-colors duration-200 focus:outline-none"
                  style={{
                    border: '1px solid rgba(0, 255, 200, 0.2)',
                    boxShadow: '0 0 8px rgba(0, 255, 200, 0.1)',
                  }}
                  onClick={() => setSidebarOpen(false)}
                >
                  <span className="sr-only">Close sidebar</span>
                  <XMarkIcon
                    className="h-5 w-5"
                    style={{ color: '#00ffc8', filter: 'drop-shadow(0 0 4px rgba(0, 255, 200, 0.5))' }}
                    aria-hidden="true"
                  />
                </button>
              </div>
              <NavLink
                href="/"
                onClick={() => setSidebarOpen(false)}
                className="mt-2 ml-4 flex flex-shrink-0 items-center px-4 cursor-pointer"
              >
                <LogoSidebar />
              </NavLink>
              <div className="mt-8 h-0 flex-1 overflow-y-auto">
                <nav className="space-y-1 px-2">
                  {navigation?.map((item: any, i: any) => (
                    <NavigationLink
                      key={i}
                      item={item}
                      index={i}
                      setSidebarOpen={setSidebarOpen}
                    />
                  ))}
                </nav>
              </div>
            </Dialog.Panel>
          </Transition.Child>
          <div className="w-14 flex-shrink-0" aria-hidden="true">
            {/* Element to force sidebar to shrink to fit close icon */}
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  )
}

export default MobileSidebar
