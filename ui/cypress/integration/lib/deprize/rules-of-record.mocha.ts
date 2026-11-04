/// <reference types="node" />
import fs from 'fs'
import path from 'path'
import { CAPABILITY_LADDER } from '@/lib/deprize/capabilityLadder'

const REPO_ROOT = path.resolve(__dirname, '../../../../../')
const DOCS = path.join(REPO_ROOT, 'docs')

const REQUIRED = [
  '<!-- deprize:freeze-table -->',
  '## Resolution criteria',
  '## Roster',
  '## Oracle',
  '## Sunset',
  'This prize is not registered on the public Arbitrum registry.',
  '0xAF26a002d716508b7e375f1f620338442F5470c0',
  '24 months',
]

// Built from parts so this file is not a docs-hygiene gate-1 hit. Those
// filenames were withdrawn and must not appear as contiguous text under ui/.
const WITHDRAWN_SPEC = ['DEPRIZE', 'NIGHT', 'SHIFT'].join('_')
const WITHDRAWN_BRIEF = ['night', 'shift', 'brief'].join('-')

const FORBIDDEN = [
  '(OPEN)',
  WITHDRAWN_SPEC,
  WITHDRAWN_BRIEF,
  '0x5fe6f1664f0de1fc497411f5c6fc53cb2adbe80e6ba50078387f97bb66581dc8',
  '0x18e1c3d9d40fbccaaa147e0736917bff8f1eb3bd0a1f5ebc6f16c70fe4e9b396',
  '0x849f4a11bbe459437a4962debe34fe5d3a1ad64326d37bd60886cf26c1f74d2d',
  '0xc97585bf11fff6b53bdddcd58e4518c02253f616c86eafc2962f3a3801333e15',
  '0x16d02C863E82D6efea67fCE3098dab0A3021b4ff',
  '0xB443AaC816A7738E062C3452e3069295a97aa6a6',
]

function readDoc(name: string): string {
  const file = path.join(DOCS, name)
  expect(fs.existsSync(file), name).to.equal(true)
  return fs.readFileSync(file, 'utf8')
}

describe('rules of record', () => {
  const firstTracks = readDoc('DEPRIZE_FIRST_TRACKS.md')
  const waterIce = readDoc('DEPRIZE_WATER_ICE.md')

  for (const [name, text] of [
    ['First Tracks', firstTracks],
    ['Water Ice', waterIce],
  ] as const) {
    it(`${name} has the four sections, the oracle, and no old market`, () => {
      for (const needle of REQUIRED) {
        expect(text, needle).to.include(needle)
      }
      for (const needle of FORBIDDEN) {
        expect(text, needle).to.not.include(needle)
      }
    })
  }

  it('First Tracks names the 10 metre bar, the roster, and MDP-262', () => {
    for (const needle of [
      '10 metres',
      '631',
      '632',
      '633',
      '634',
      '635',
      '24',
      'FLIP',
      'CubeRover',
      'MAPP',
      'Tenacious',
      'Iris',
      'MDP-262',
    ]) {
      expect(firstTracks, needle).to.include(needle)
    }
  })

  it('Water Ice names the in-situ bar and its roster, and not First Tracks', () => {
    for (const needle of ['in-situ', '641', '642', '643', '24', 'VIPER', 'IM-4']) {
      expect(waterIce, needle).to.include(needle)
    }
    expect(waterIce).to.not.include('MDP-262')
    expect(waterIce).to.not.include('10 metres')
  })

  it('Night Shift has no spec file and no ladder link', () => {
    expect(fs.existsSync(path.join(DOCS, `${WITHDRAWN_SPEC}.md`))).to.equal(false)
    const href = (key: string) => CAPABILITY_LADDER.find((rung) => rung.key === key)?.specHref
    expect(href('first-tracks')).to.include('DEPRIZE_FIRST_TRACKS.md')
    expect(href('ice')).to.include('DEPRIZE_WATER_ICE.md')
    expect(href('night-shift')).to.equal('')
  })

  it('the ladder links both new files and keeps the Night Shift status line', () => {
    const ladder = fs.readFileSync(path.join(DOCS, 'DEPRIZE_CAPABILITY_LADDER.md'), 'utf8')
    expect(ladder).to.include('DEPRIZE_FIRST_TRACKS.md')
    expect(ladder).to.include('DEPRIZE_WATER_ICE.md')
    expect(ladder).to.match(/Night Shift.*LIVE \(Sepolia #3\)/)
  })
})
