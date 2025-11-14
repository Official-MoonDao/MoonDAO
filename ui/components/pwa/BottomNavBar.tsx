import {
  HomeIcon,
  RocketLaunchIcon,
  ShoppingBagIcon,
  UserGroupIcon,
  BriefcaseIcon,
} from '@heroicons/react/24/outline'
import {
  HomeIcon as HomeIconSolid,
  RocketLaunchIcon as RocketLaunchIconSolid,
  ShoppingBagIcon as ShoppingBagIconSolid,
  UserGroupIcon as UserGroupIconSolid,
  BriefcaseIcon as BriefcaseIconSolid,
} from '@heroicons/react/24/solid'
import { useRouter } from 'next/router'
import { useContext, useMemo } from 'react'
import CitizenContext from '@/lib/citizen/citizen-context'

interface NavItem {
  label: string
  icon: any
  iconSolid: any
  path: string
}

export default function BottomNavBar() {
  const router = useRouter()
  const { citizen } = useContext(CitizenContext)

  const navItems: NavItem[] = useMemo(() => {
    if (citizen) {
      return [
        {
          label: 'Dashboard',
          icon: HomeIcon,
          iconSolid: HomeIconSolid,
          path: '/dashboard',
        },
        {
          label: 'Quests',
          icon: RocketLaunchIcon,
          iconSolid: RocketLaunchIconSolid,
          path: '/quests',
        },
        {
          label: 'Marketplace',
          icon: ShoppingBagIcon,
          iconSolid: ShoppingBagIconSolid,
          path: '/marketplace',
        },
        {
          label: 'Jobs',
          icon: BriefcaseIcon,
          iconSolid: BriefcaseIconSolid,
          path: '/jobs',
        },
        {
          label: 'Network',
          icon: UserGroupIcon,
          iconSolid: UserGroupIconSolid,
          path: '/network',
        },
      ]
    }

    return [
      {
        label: 'Home',
        icon: HomeIcon,
        iconSolid: HomeIconSolid,
        path: '/',
      },
      {
        label: 'Marketplace',
        icon: ShoppingBagIcon,
        iconSolid: ShoppingBagIconSolid,
        path: '/marketplace',
      },
      {
        label: 'Network',
        icon: UserGroupIcon,
        iconSolid: UserGroupIconSolid,
        path: '/network',
      },
    ]
  }, [citizen])

  const isActive = (path: string) => {
    if (path === '/') {
      return router.pathname === '/'
    }
    return router.pathname.startsWith(path)
  }

  const handleNavClick = (path: string) => {
    router.push(path)
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[9999] bg-gradient-to-t from-[#0a0a0a] via-[#0d0d0d] to-[#0d0d0d]/95 backdrop-blur-xl border-t border-white/10"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.5)',
      }}
    >
      <div className="flex items-center justify-around h-16 px-2 max-w-screen-xl mx-auto">
        {navItems.map((item) => {
          const active = isActive(item.path)
          const Icon = active ? item.iconSolid : item.icon

          return (
            <button
              key={item.path}
              onClick={() => handleNavClick(item.path)}
              className={`
                flex flex-col items-center justify-center
                flex-1 h-full min-w-0
                transition-all duration-200 ease-out
                ${active ? 'text-blue-400' : 'text-gray-400 hover:text-gray-200 active:scale-95'}
              `}
            >
              <div
                className={`
                relative flex items-center justify-center
                transition-all duration-200
                ${active ? 'scale-110' : 'scale-100'}
              `}
              >
                <Icon className="w-6 h-6" />
                {active && (
                  <div className="absolute -bottom-1 w-1 h-1 rounded-full bg-blue-400 animate-pulse" />
                )}
              </div>
              <span
                className={`
                text-xs mt-1 font-medium truncate max-w-full
                transition-all duration-200
                ${active ? 'opacity-100' : 'opacity-70'}
              `}
              >
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
