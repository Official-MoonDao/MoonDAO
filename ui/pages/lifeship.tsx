import {
  UserAddIcon,
  CurrencyDollarIcon,
  LockClosedIcon,
  PlusIcon,
} from '@heroicons/react/outline'
import { BigNumber } from 'ethers'
import useTranslation from 'next-translate/useTranslation'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import React from 'react'
import { useState, useEffect } from 'react'
import { MOONEYToken } from '../lib/config'
import { useAccount } from '../lib/use-wagmi'
import { useVMOONEYLock } from '../lib/ve-token'
import GradientLink from '../components/layout/GradientLink'
import Head from '../components/layout/Head'
import HomeCard from '../components/layout/HomeCard'
import MainCard from '../components/layout/MainCard'
import flag from '../public/Original.png'
import { Scene } from '../r3f/Moon/Scene'

export default function Lifeship() {
  const { data: account } = useAccount()
  const { data: vMooneyLock, isLoading: vMooneyLockLoading } = useVMOONEYLock(
    account?.address
  )
  const [validLock, setValidLock] = useState(false)

  useEffect(() => {
    if (vMooneyLock && vMooneyLock[1] !== 0) {
      setValidLock(
        BigNumber.from(+new Date('2021-01-01T00:00:00')).lte(
          vMooneyLock[1].mul(1000)
        )
      )
    }
  }, [account, vMooneyLock])
  function LifeshipLinkButton({ label }: any) {
    return (
      <button
        className="border-style btn text-n3blue normal-case font-medium w-full  bg-transparent hover:bg-n3blue hover:text-black duration-[0.6s] ease-in-ease-out text-1xl"
        onClick={() =>
          window.open(
            `https://lifeship.com/discount/MOONDAO${
              validLock ? '1' : ''
            }?redirect=/collections/shop-all/products/dna-to-moon`
          )
        }
      >
        {label}
      </button>
    )
  }
  return (
    <div className="animate-fadeIn">
      <Scene zoomEnabled />
      <Head title="Lifeship" />
      <div className="flex flex-col max-w-3xl">
        <div className="grid xl:grid-cols-1 mt-2 gap-8">
          <div className="flex flex-col md:flex-row items-center md:gap-4 justify-center ">
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
                {'MoonDAO has partnered with '}
                <span onClick={() => window.open('https://lifeship.com/')}>
                  <button className="text-n3blue hover:scale-[1.025] ease-in-ease-out duration-300">
                    Lifeship
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
              <LifeshipLinkButton label="Send your DNA to the Moon!" />
            </div>
          </MainCard>
        </div>
      </div>
    </div>
  )
}
