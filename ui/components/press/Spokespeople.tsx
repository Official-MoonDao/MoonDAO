import Image from 'next/image'
import React from 'react'
import type { Spokesperson } from '@/lib/press/press-data'

export default function Spokespeople({ people }: { people: Spokesperson[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {people.map((person) => (
        <div
          key={person.name}
          className="flex flex-col rounded-xl border border-slate-600/30 bg-gradient-to-b from-slate-700/20 to-slate-800/30 p-5"
        >
          {person.image && (
            <div className="relative mb-4 h-16 w-16 overflow-hidden rounded-full bg-black/30">
              <Image src={person.image} alt={person.name} fill className="object-cover" />
            </div>
          )}
          <h3 className="font-GoodTimes text-lg text-white">{person.name}</h3>
          <p className="mt-1 font-RobotoMono text-xs uppercase tracking-[0.2em] text-slate-400">
            {person.role}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">{person.bio}</p>
        </div>
      ))}
    </div>
  )
}
