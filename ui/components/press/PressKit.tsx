import { ArrowDownTrayIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'
import Image from 'next/image'
import React from 'react'
import type { BrandAsset } from '@/lib/press/press-data'

function AssetLink({ asset }: { asset: BrandAsset }) {
  return (
    <a
      href={asset.href}
      target="_blank"
      rel="noopener noreferrer"
      download={asset.external ? undefined : ''}
      className="group flex items-start justify-between gap-3 rounded-xl border border-slate-600/30 bg-gradient-to-b from-slate-700/20 to-slate-800/30 p-4 transition-all duration-200 hover:border-slate-500/50"
    >
      <div className="min-w-0">
        <span className="block font-semibold text-white transition-colors group-hover:text-slate-200">
          {asset.name}
        </span>
        <span className="mt-1 block text-xs leading-relaxed text-slate-400">
          {asset.description}
        </span>
      </div>
      {asset.external ? (
        <ArrowTopRightOnSquareIcon className="mt-1 h-4 w-4 flex-shrink-0 text-slate-400 transition-colors group-hover:text-slate-300" />
      ) : (
        <ArrowDownTrayIcon className="mt-1 h-4 w-4 flex-shrink-0 text-slate-400 transition-colors group-hover:text-slate-300" />
      )}
    </a>
  )
}

export default function PressKit({
  brandAssets,
  imagery,
}: {
  brandAssets: BrandAsset[]
  imagery: BrandAsset[]
}) {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h3 className="mb-4 font-GoodTimes text-lg text-slate-400">Logos &amp; brand assets</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {brandAssets.map((asset) => (
            <AssetLink key={asset.href} asset={asset} />
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-4 font-GoodTimes text-lg text-slate-400">Approved imagery</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {imagery.map((image) => (
            <a
              key={image.href}
              href={image.href}
              target="_blank"
              rel="noopener noreferrer"
              download=""
              className="group overflow-hidden rounded-xl border border-slate-600/30 bg-gradient-to-b from-slate-700/20 to-slate-800/30 transition-all duration-200 hover:border-slate-500/50"
            >
              <div className="relative h-40 w-full bg-black/30">
                <Image src={image.href} alt={image.name} fill className="object-contain p-3" />
              </div>
              <div className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <span className="block font-semibold text-white transition-colors group-hover:text-slate-200">
                    {image.name}
                  </span>
                  <span className="mt-1 block text-xs text-slate-400">{image.description}</span>
                </div>
                <ArrowDownTrayIcon className="mt-1 h-4 w-4 flex-shrink-0 text-slate-400 transition-colors group-hover:text-slate-300" />
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
