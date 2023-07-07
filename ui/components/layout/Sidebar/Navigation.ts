import {
    UserPlusIcon,
    HomeIcon,
    NewspaperIcon,
 
    LockClosedIcon,
    PlusIcon,
    TableCellsIcon,

    RocketLaunchIcon,
  } from '@heroicons/react/24/outline'

export const navigation = [
    {
      name: 'home',
      href: '/',
      icon: TableCellsIcon,
    },
    {
      name: 'buyMOONEY',
      href: `https://app.uniswap.org/#/swap?inputCurrency=ETH&outputCurrency=0x20d4DB1946859E2Adb0e5ACC2eac58047aD41395&chain=mainnet`,
      icon: PlusIcon
    },
    {
      name: 'lockTokens',
      href: '/lock',
      icon: LockClosedIcon
    },
    {
      name: 'zero-g',
      href: '/zero-g',
      icon: RocketLaunchIcon
    },
    {
      name: 'lifeship',
      href: '/lifeship',
      icon: RocketLaunchIcon
    },
    {
      name: 'governance',
      href: `https://snapshot.org/#/tomoondao.eth`,
      icon: UserPlusIcon
    },
    {
      name: 'homepage',
      href: 'https://moondao.com',
      icon: HomeIcon
    },
    {
      name: 'docs',
      href: 'https://moondao.com/docs/introduction',
      icon: NewspaperIcon
    },
  ]