/**
 * Moon Base Zero — terrain shader surgery (headless, mocha + chai).
 *
 * The terrain is lit by replacing pieces of three's Lambert shader with regolith
 * physics. Those replacements are string matches against source three owns, and
 * `String.replace` does not fail when its anchor is missing — it returns the
 * input. So a three upgrade that renames a chunk, reorders an include, or
 * reformats a #define would leave a material that compiles cleanly, renders
 * plausibly, and is silently back to Lambert shading on the mesh's 15.6 m
 * normals. Nobody would catch that by eye.
 *
 * This runs the real patches against the real ShaderLib source and asserts that
 * each one landed, that the result is internally consistent, and that the two
 * mistakes with no visual symptom — a stale varying name and a double-applied
 * albedo — are impossible.
 */
import { expect } from 'chai'
import { ShaderChunk, ShaderLib } from 'three'
import { SINGLE_SCATTERING_ALBEDO } from '../../../lib/lunar-atlas/regolith'
import {
  DETAIL_OCTAVES,
  TERRAIN_FRAGMENT_PATCHES,
  TERRAIN_VERTEX_PATCHES,
  applyShaderPatches,
} from '../../../lib/lunar-atlas/terrainShader'

const lambert = ShaderLib.lambert

// three's own include resolution, reimplemented so the tests can see the program
// the GPU would actually get.
//
// This is not incidental — it is the crux of what these tests check. Patches run
// in onBeforeCompile, which fires BEFORE three expands #include, so the source a
// patch matches against contains include DIRECTIVES, not chunk bodies. Anchoring
// a patch on anything that lives inside a chunk therefore silently does nothing.
// So: patch the unexpanded source exactly as the runtime does, then expand, then
// assert on the result.
const INCLUDE_PATTERN = /^[ \t]*#include +<([\w\d./]+)>/gm

function resolveIncludes(src: string): string {
  return src.replace(INCLUDE_PATTERN, (_match, name: string) => {
    const chunk = (ShaderChunk as unknown as Record<string, string>)[name]
    if (chunk === undefined) throw new Error(`unknown shader chunk: ${name}`)
    return resolveIncludes(chunk)
  })
}

describe('terrain shader patches against three s real Lambert source', () => {
  it('every anchor still exists, so no patch is a silent no-op', () => {
    // The single most valuable assertion in this file: applyShaderPatches throws
    // if any anchor misses, so simply completing is the test.
    expect(() => applyShaderPatches(lambert.vertexShader, TERRAIN_VERTEX_PATCHES)).to.not.throw()
    expect(() =>
      applyShaderPatches(lambert.fragmentShader, TERRAIN_FRAGMENT_PATCHES)
    ).to.not.throw()
  })

  it('reports which patch broke rather than failing silently', () => {
    expect(() =>
      applyShaderPatches('nothing to match here', [
        { label: 'canary', find: '#include <not_a_chunk>', insert: 'x' },
      ])
    ).to.throw(/canary/)
  })

  describe('the patched fragment shader', () => {
    const src = applyShaderPatches(lambert.fragmentShader, TERRAIN_FRAGMENT_PATCHES)
    const program = resolveIncludes(src)

    it('anchors every patch on an include directive, not on chunk contents', () => {
      // The failure mode that actually happened while writing this. Chunk bodies
      // are not present when onBeforeCompile runs, so a patch anchored inside one
      // matches nothing and returns the shader untouched.
      for (const patch of TERRAIN_FRAGMENT_PATCHES.concat(TERRAIN_VERTEX_PATCHES)) {
        expect(typeof patch.find, patch.label).to.equal('string')
        expect(patch.find as string, patch.label).to.match(/^#include <[\w./]+>$/)
      }
    })

    it('repoints the RE_Direct macro at Hapke, in the only order that works', () => {
      // A macro cannot be redefined in place, so the sequence has to be: three's
      // chunk defines it, we #undef it, we redefine it, and only then is it
      // called. Any other order either fails to compile or silently keeps
      // Lambert.
      const lambertDefine = program.search(/#define\s+RE_Direct\s+RE_Direct_Lambert/)
      const undefIdx = program.indexOf('#undef RE_Direct')
      const hapkeDefine = program.indexOf('#define RE_Direct RE_Direct_Hapke')
      const callSite = program.search(/RE_Direct\(\s*directLight/)

      expect(lambertDefine, 'three still defines its own').to.be.greaterThan(-1)
      expect(undefIdx, '#undef must follow it').to.be.greaterThan(lambertDefine)
      expect(hapkeDefine, 'redefine must follow the #undef').to.be.greaterThan(undefIdx)
      expect(callSite, 'the call site must see the new definition').to.be.greaterThan(hapkeDefine)
      expect(program).to.contain('void RE_Direct_Hapke(')
    })

    it('does not apply a cosine or a Lambert lobe on top of the BRDF', () => {
      // Hapke's r already carries the incidence cosine inside mu0/(mu0 + mu).
      // Multiplying by dotNL or by BRDF_Lambert as well would darken every slope
      // twice, most visibly at grazing incidence — which is where the true polar
      // sun puts everything.
      const body = src.slice(src.indexOf('void RE_Direct_Hapke('))
      const accumulation = body.slice(0, body.indexOf('#define RE_Direct'))
      expect(accumulation).to.contain('directLight.color * r * material.diffuseColor')
      expect(accumulation).to.not.contain('BRDF_Lambert')
      expect(accumulation).to.not.contain('dotNL')
    })

    it('depends on USE_UV for the varying it samples with', () => {
      // vUv is only declared when USE_UV is defined, and this material has no map
      // to imply it, so SouthPoleTerrain forces the define. Asserting the guard
      // here documents why removing that define breaks compilation rather than
      // just changing a lookup.
      expect(program).to.contain('varying vec2 vUv;')
      const decl = program.indexOf('varying vec2 vUv;')
      const guard = program.lastIndexOf('USE_UV', decl)
      expect(guard).to.be.greaterThan(-1)
    })

    it('uses vUv, which is the varying that actually exists without a map', () => {
      // vMapUv only exists when USE_MAP is defined, and the terrain has no map
      // any more (the hillshaded albedo is gone). Referencing it would fail to
      // compile; referencing it in only SOME of the lookups is worse, because the
      // shader would still be valid on a build that happened to define USE_MAP.
      expect(src).to.contain('texture2D(terrainNormalMap, vUv)')
      expect(src).to.not.contain('vMapUv')
    })

    it('overrides the normal after three s own normal maps, not before', () => {
      // Injecting after normal_fragment_begin instead would let a later chunk
      // overwrite the per-pixel normal, which would silently fall back to the
      // interpolated mesh normal.
      const override = src.indexOf('vec2 base = texture2D(terrainNormalMap')
      const normalMaps = src.indexOf('#include <normal_fragment_maps>')
      expect(normalMaps).to.be.greaterThan(-1)
      expect(override).to.be.greaterThan(normalMaps)
      // And it must land before the lighting that consumes it.
      expect(override).to.be.lessThan(src.indexOf('#include <lights_fragment_begin>'))
    })

    it('declares every uniform the component feeds it', () => {
      // A uniform set from TypeScript but not declared in GLSL is dropped
      // silently by three, and the shading just comes out wrong.
      for (const name of [
        'terrainNormalMap',
        'detailSlopeMap',
        'mapXDir',
        'bounceRadiance',
      ]) {
        expect(src, name).to.match(new RegExp(`uniform\\s+\\w+\\s+${name}\\s*;`))
      }
    })

    it('carries the solved single scattering albedo, not a hand-typed copy', () => {
      // HAPKE_GLSL interpolates the exported constant, so the shader cannot drift
      // from the value the unit tests calibrate against REGOLITH_ALBEDO.
      expect(src).to.contain(`const float HAPKE_W = ${SINGLE_SCATTERING_ALBEDO}`)
    })

    it('adds one detail lookup per octave, at the declared repeats', () => {
      for (const [repeat] of DETAIL_OCTAVES) {
        expect(src).to.contain(`texture2D(detailSlopeMap, vUv * ${repeat.toFixed(1)})`)
      }
      const lookups = src.match(/texture2D\(detailSlopeMap/g) ?? []
      expect(lookups.length).to.equal(DETAIL_OCTAVES.length)
    })

    it('combines detail with the terrain by adding slopes, not normals', () => {
      // Superimposed height fields add their gradients. Blending normals instead
      // lets whichever is steeper flatten the other, which at the ridge crest
      // would erase the craterlets and in the flats would erase the ridge.
      expect(src).to.contain('vec2 grad = -base / baseZ;')
      expect(src).to.match(/grad \+= texture2D\(detailSlopeMap/)
    })
  })

  describe('the patched vertex shader', () => {
    const src = applyShaderPatches(lambert.vertexShader, TERRAIN_VERTEX_PATCHES)

    it('declares and fills the world-position varying', () => {
      expect(src).to.contain('varying vec3 vTerrainWorldPos;')
      expect(src).to.contain('vTerrainWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;')
    })

    it('fills it after the position is established', () => {
      expect(src.indexOf('vTerrainWorldPos =')).to.be.greaterThan(
        src.indexOf('#include <begin_vertex>')
      )
    })

    it('keeps three s shadow plumbing intact', () => {
      // The whole reason for patching Lambert rather than writing a
      // ShaderMaterial: shadow attenuation arrives already folded into
      // directLight.color. Losing these chunks would lose every cast shadow.
      expect(src).to.contain('#include <shadowmap_vertex>')
      expect(src).to.contain('#include <shadowmap_pars_vertex>')
    })
  })
})
