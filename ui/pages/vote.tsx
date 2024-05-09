import { PlusIcon, QueueListIcon } from '@heroicons/react/24/solid'
import { NanceProvider } from '@nance/nance-hooks'
import Head from '../components/layout/Head'
import ProposalList from '../components/nance/ProposalList'

const links = [
  {
    name: 'New Proposal',
    href: '#',
    description: 'Create a new proposal.',
    icon: PlusIcon,
  },
  {
    name: 'Queue Transactions',
    href: '#',
    description: 'Queue transactions from passed proposals.',
    icon: QueueListIcon,
  },
]

export default function SpaceIndex() {
  return (
    <div className="flex flex-col justify-center items-center animate-fadeIn lg:px-3 lg:pb-14 lg:mt-1 md:max-w-[1080px]">
      <Head title="Vote" />
      <div className="absolute top-0 left-0 lg:left-[20px] h-[100vh] overflow-auto w-full py-5 pl-10 pr-8">
        <main className="flex-1">
          <NanceProvider apiUrl="https://api.nance.app">
            <ProposalList />
          </NanceProvider>
        </main>
      </div>
    </div>
  )
}

// export default function Vote() {
//   return (
//     <div className="flex flex-col justify-center items-center animate-fadeIn lg:px-3 lg:pb-14 lg:mt-1 md:max-w-[1080px]">
//       <Head title="Vote" />
//       <iframe
//         className="absolute top-0 left-0 lg:left-[35px] h-[100vh] overflow-auto w-full"
//         src="https://nance.app/s/moondao"
//         allowFullScreen
//       />
//     </div>
//   )
// }
