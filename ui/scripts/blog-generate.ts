import fs from 'fs'
import path from 'path'
import { listPosts } from '../lib/blog/loadPosts'
import { buildRssXml } from '../lib/blog/rss'

const outDir = path.join(process.cwd(), 'public', 'blog')
const outFile = path.join(outDir, 'rss.xml')

fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(outFile, buildRssXml(listPosts()), 'utf8')
console.log(`wrote ${path.relative(process.cwd(), outFile)}`)
