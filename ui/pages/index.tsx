import {
  UserAddIcon,
  CurrencyDollarIcon,
  LockClosedIcon,
  PlusIcon,
} from '@heroicons/react/outline'
import Image from 'next/image'
import Link from 'next/link'
import React from 'react'
import { nationToken, veNationRewardsMultiplier } from '../lib/config'
import GradientLink from '../components/GradientLink'
import Head from '../components/Head'
import HomeCard from '../components/HomeCard'
import flag from '../public/Original.png'

export default function Index() {
  return (
    <>
      <Head title="Home" />
      <div className="flex flex-col max-w-3xl">
        <h1 className="card-title text-center text-3xl font-semibold mb-2">
          Welcome to MoonDAO
          <Image src={flag} width={36} height={36} />
        </h1>

        <p className="mb-8">
        MoonDAO’s mission is is to create a self-sustaining, 
        self-governing colony on the Moon to act as a launch point for 
        humanity to explore the cosmos.{' '}
          <GradientLink text="Read more" href="https://moondao.com" />
          <br />
          <br />
          Here you can perform on-chain operations related to the MoonDAO
          communinity, such as...
        </p>

        <Link href="/claim">
          <a className="btn btn-lg btn-primary mb-1 normal-case font-medium">
            Claim $MOONEY
          </a>
        </Link>

        <p className="text-center">and then...</p>

        <div className="grid xl:grid-cols-2 mt-2 gap-8">
          <HomeCard
            href="/lock"
            icon={
              <LockClosedIcon className="h-5 w-5 absolute right-8 text-n3blue" />
            }
            title="Get $veMOONEY"
            linkText="Get $veMOONEY"
          >
            <p>
              Lock your $MOONEY to obtain $veMOONEY and help govern MoonDAO. 
              $veMOONEY is required to vote on MooDAO proposals through Snapshot.
            </p>
          </HomeCard>

        </div>
      </div>
    </>
  )
}
