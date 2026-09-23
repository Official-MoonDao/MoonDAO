import fs from 'fs'
import path from 'path'
import { listUpdates } from '../lib/updates/loadUpdates'
import { buildRssXml } from '../lib/updates/rss'

const outDir = path.join(process.cwd(), 'public', 'updates')
const outFile = path.join(outDir, 'rss.xml')

fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(outFile, buildRssXml(listUpdates()), 'utf8')
console.log(`wrote ${path.relative(process.cwd(), outFile)}`)
