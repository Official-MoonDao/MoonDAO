import type { UpdateBlock as Block } from '@/lib/updates/blocks'
import { Heatmap, Ledger, Stats } from './DataBlocks'
import { Cta, Screens } from './Showcase'
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
  }
}
