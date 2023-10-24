import { InformationCircleIcon } from '@heroicons/react/24/outline'
import Image from 'next/image'
import { useState } from 'react'

export function ProofOfHumanity() {
  function Card({ label, description, children }: any) {
    return (
      <div className="flex flex-col p-4 border-2 border-[#ffffff25] w-[225px]">
        <Image src={'/icons/poh-icon.png'} width={40} height={40} alt="" />
        <h1 className="font-bold">{label}</h1>
        <p>{description}</p>
        {children}
      </div>
    )
  }

  return (
    <div className="flex gap-4">
      <Card
        label={'Gitcoin Passport'}
        description={'Achieve a score of 15 or more.'}
      ></Card>
      <Card
        label={'5 Minute Onboarding Call'}
        description={
          'Breifly meet with an onboarding operator as a proof of liveness.'
        }
      ></Card>
      <Card
        label={'Connect to Guild.xyz'}
        description={
          'Access our Discord community with your new unlocked rules.'
        }
      ></Card>
    </div>
  )
}
