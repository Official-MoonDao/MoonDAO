import type { UpdateBlock as Block } from '@/lib/updates/blocks'
import { Heatmap, Ledger, Stats } from './DataBlocks'
import { Cta, Graphic, Screens, Timeline } from './Showcase'
import UpdateChart from './UpdateChart'

export default function UpdateBlock({ block }: { block: Block }) {
  switch (block.kind) {
    case 'chart':
      return <UpdateChart spec={block.spec} />
    case 'stats':
      return <Stats spec={block.spec} />
    case 'heatmap':
      return <Heatmap spec={block.spec} />
    case 'ledger':
      return <Ledger spec={block.spec} />
    case 'screens':
      return <Screens spec={block.spec} />
    case 'cta':
      return <Cta spec={block.spec} />
    case 'timeline':
      return <Timeline spec={block.spec} />
    case 'graphic':
      return <Graphic spec={block.spec} />
  }
}
