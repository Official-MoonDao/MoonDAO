import {
  UserAddIcon,
  CurrencyDollarIcon,
  LockClosedIcon,
  PlusIcon,
} from '@heroicons/react/outline'
import Image from 'next/image'
import Link from 'next/link'
import React from 'react'
import { MOONEYToken } from '../lib/config'
import GradientLink from '../components/GradientLink'
import Head from '../components/Head'
import HomeCard from '../components/HomeCard'
import flag from '../public/Original.png'

export default function Index() {
  return (
    <>
      <Head title="Home" />
      <div className="flex flex-col max-w-3xl">
        <h1 className="card-title text-center text-3xl font-semibold font-GoodTimes mb-2">
          The MoonDAO App
          <Image src={flag} width={36} height={36} />
        </h1>

        <p className="mb-8 font-RobotoMono">
          Here you can perform on-chain operations related to the MoonDAO
          community.
        </p>

        <div className="grid xl:grid-cols-1 mt-2 gap-8">
          <HomeCard
            href="/lock"
            icon={
              <LockClosedIcon className="h-5 w-5 absolute right-8 text-n3blue" />
            }
            title="Get $vMOONEY"
            linkText="Get $vMOONEY"
          >
            <p>
              Lock your $MOONEY to obtain $vMOONEY and help govern MoonDAO. 
              $vMOONEY is required to vote on MooDAO proposals through Snapshot. 
            </p>
          </HomeCard>

        </div>
      </div>
    </>
  )
}
