import {
  UserAddIcon,
  CurrencyDollarIcon,
  LockClosedIcon,
  PlusIcon,
} from '@heroicons/react/outline'
import useTranslation from 'next-translate/useTranslation'
import Image from 'next/image'
import Link from 'next/link'
import React from 'react'
import { MOONEYToken } from '../lib/config'
import GradientLink from '../components/layout/GradientLink'
import Head from '../components/layout/Head'
import HomeCard from '../components/layout/HomeCard'
import MainCard from '../components/layout/MainCard'
import flag from '../public/Original.png'
import { Scene } from '../r3f/Moon/Scene'

function LifeshipLinkButton({ label, linkNumber = '' }: any) {
  return (
    <button className="border-style btn text-n3blue normal-case font-medium w-full  bg-transparent hover:bg-n3blue hover:text-black duration-[0.6s] ease-in-ease-out text-1xl">
      <Link
        href={`https://lifeship.com/discount/MOONDAO${linkNumber}?redirect=/collections/shop-all/products/dna-to-moon`}
      >
        {label}
      </Link>
    </button>
  )
}

export default function Lifeship() {
  return (
    <div className="animate-fadeIn">
      <Scene zoomEnabled />
      <Head title="Lifeship" />
      <div className="flex flex-col max-w-3xl">
        <div className="grid xl:grid-cols-1 mt-2 gap-8">
          <div className="flex flex-col md:flex-row items-center md:gap-4 ">
            <h1 className="card-title text-center text-3xl font-semibold font-GoodTimes mb-2">
              {'MoonDAO'}
              <Image src={flag} width={36} height={36} />
            </h1>
            <h1 className="card-title text-center text-3xl font-semibold font-GoodTimes mb-2">
              {'  +  '}
            </h1>
            <h1 className="card-title text-center text-3xl font-semibold font-GoodTimes mb-2">
              {'Lifeship'}
              <Image src={'/LifeShip_Main.png'} width={36} height={36} />
            </h1>
          </div>
          <MainCard title="Lifeship">
            <div className="mb-2 max-w-2xl font-RobotoMono">
              <p>
                {'MoonDAO has parterned with '}
                <span>
                  <button className="text-n3blue hover:scale-[1.025] ease-in-ease-out duration-300">
                    <Link href="https://lifeship.com/"> Lifeship</Link>
                  </button>
                </span>
              </p>
              <br></br>
              <p>
                {
                  'Send your DNA to the Moon. Memorable space experience or gift. Live forever by saving your genetic code in a record of humanity. Fly on a rocket to the Moon.'
                }
              </p>
            </div>
            <div className="flex flex-col items-center gap-4">
              <LifeshipLinkButton label="MoonDAO" />
              <LifeshipLinkButton label="MoonDAO 1" linkNumber="1" />
              <LifeshipLinkButton label="MoonDAO 2" linkNumber="2" />
            </div>
          </MainCard>
        </div>
      </div>
    </div>
  )
}
