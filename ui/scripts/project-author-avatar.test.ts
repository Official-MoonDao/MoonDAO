import { expect } from 'chai'
import fs from 'fs'
import path from 'path'

/**
 * Source guards for project-author avatars on /projects.
 *
 * Citizen portraits are stored as `ipfs://` CIDs. ipfs.io returns 403 for
 * those pins (Pablo, EngiBob, Rodrigo, and the rest of the citizen table);
 * `getIPFSGateway` sends them to the dedicated Pinata gateway that serves
 * the bytes. These checks live in a Node-only mocha script: Cypress
 * component tests run in the browser, where `fs.readFileSync` is not
 * available.
 */
describe('project author citizen avatars', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../components/project/AuthorCitizenLink.tsx'),
    'utf8'
  )

  it('does not hardcode a public IPFS gateway for the portrait', () => {
    for (const gateway of [
      'https://ipfs.io/ipfs/',
      'https://dweb.link/ipfs/',
      'https://cloudflare-ipfs.com/ipfs/',
      'https://gateway.pinata.cloud/ipfs/',
    ]) {
      expect(source).to.not.include(gateway)
    }
  })

  it('resolves the portrait through getIPFSGateway', () => {
    expect(source).to.include("import { getIPFSGateway } from '@/lib/ipfs/gateway'")
    expect(source).to.match(/getIPFSGateway\(\s*citizenMeta\?\.image/)
    expect(source).to.not.include("avatarSrc.replace('ipfs://'")
    expect(source).to.not.include('avatarSrc.startsWith(')
  })
})
