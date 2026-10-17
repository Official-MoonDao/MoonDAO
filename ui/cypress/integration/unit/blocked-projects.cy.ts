import { blockedMdpsForChain, MAINNET_BLOCKED_MDPS } from 'const/whitelist'
import { isBlockedProject } from '../../../lib/project/isBlockedProject'

describe('blocked projects', () => {
  it('hides withdrawn MDP-281 on mainnet and keeps other proposals listed', () => {
    expect(MAINNET_BLOCKED_MDPS).to.include(281)
    expect(blockedMdpsForChain('mainnet').has(281)).to.equal(true)
    expect(blockedMdpsForChain('testnet').has(281)).to.equal(false)
    expect(blockedMdpsForChain('mainnet').has(270)).to.equal(false)

    expect(isBlockedProject({ id: 163, MDP: 281 }, 'mainnet')).to.equal(true)
    expect(isBlockedProject({ id: 163, MDP: '281' }, 'mainnet')).to.equal(true)
    expect(isBlockedProject({ id: 150, MDP: 268 }, 'mainnet')).to.equal(false)
    expect(isBlockedProject({ id: 163, MDP: 281 }, 'testnet')).to.equal(false)
    expect(isBlockedProject(null, 'mainnet')).to.equal(false)
    expect(isBlockedProject({ id: null, MDP: null }, 'mainnet')).to.equal(false)
  })

  it('still hides previously blocked mainnet projects and MDPs', () => {
    expect(isBlockedProject({ id: 4, MDP: 1 }, 'mainnet')).to.equal(true)
    expect(isBlockedProject({ id: 1, MDP: 229 }, 'mainnet')).to.equal(true)
  })
})
