/**
 * Moon Base Zero — regolith shader surgery (headless, mocha + chai).
 *
 * Two material classes get this treatment: the terrain's Lambert material and the
 * graded surfaces' Standard material. They share the BRDF swap and the shadow
 * fill, because a road that reflects light by a different law than the ground it
 * crosses is wrong by about 4x at this scene's phase angles — and that is the
 * whole reason the patches are factories rather than two hand-written copies.
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
  GRADED_SURFACE_FRAGMENT_PATCHES,
  STAIN_FRAGMENT_PATCHES,
  TERRAIN_FRAGMENT_PATCHES,
  TERRAIN_VERTEX_PATCHES,
  applyShaderPatches,
} from '../../../lib/lunar-atlas/regolithShader'

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

// The graded surfaces — roads, hardstand, pads, rubble — are the same soil as the
// terrain, so they must reflect light by the same law. They ride three's Standard
// material rather than Lambert, which means a different anchor chunk and a
// different material struct, and that difference is exactly what could silently
// rot without these cases.
describe('graded surface patches against three s real Standard source', () => {
  // three routes MeshStandardMaterial to the 'physical' program, so that is the
  // source the runtime patches. Both keys are checked because the alias existing
  // is not a guarantee either way.
  for (const key of ['physical', 'standard'] as const) {
    it(`applies cleanly to ShaderLib.${key}`, () => {
      const shader = (ShaderLib as unknown as Record<string, { fragmentShader: string }>)[key]
      expect(shader, `ShaderLib.${key} must exist`).to.not.equal(undefined)
      expect(() =>
        applyShaderPatches(shader.fragmentShader, GRADED_SURFACE_FRAGMENT_PATCHES)
      ).to.not.throw()
    })
  }

  const src = applyShaderPatches(
    ShaderLib.physical.fragmentShader,
    GRADED_SURFACE_FRAGMENT_PATCHES
  )
  const program = resolveIncludes(src)

  it('takes the PhysicalMaterial struct, not Lambert s', () => {
    // The one thing that genuinely differs between the two call sites. Passing
    // LambertMaterial here would not compile, which is the good case; passing it
    // via a copy-paste that also swapped the anchor would compile and be wrong.
    expect(src).to.contain('const in PhysicalMaterial material')
    expect(src).to.not.contain('const in LambertMaterial material')
  })

  it('repoints RE_Direct away from three s physical BRDF', () => {
    const physicalDefine = program.search(/#define\s+RE_Direct\s+RE_Direct_Physical/)
    const undefIdx = program.indexOf('#undef RE_Direct')
    const hapkeDefine = program.indexOf('#define RE_Direct RE_Direct_Hapke')
    const callSite = program.search(/RE_Direct\(\s*directLight/)

    expect(physicalDefine, 'three still defines its own').to.be.greaterThan(-1)
    expect(undefIdx, '#undef must follow it').to.be.greaterThan(physicalDefine)
    expect(hapkeDefine, 'redefine must follow the #undef').to.be.greaterThan(undefIdx)
    expect(callSite, 'the call site must see the new definition').to.be.greaterThan(hapkeDefine)
  })

  it('drops the specular lobe, which is intended rather than overlooked', () => {
    // Replacing RE_Direct wholesale also removes GGX. That is correct: regolith
    // has no highlight worth the name, these materials run at roughness 0.96-1.0
    // where the lobe is a wide dim wash, and the terrain beside them has no
    // specular term at all. Keeping it would be the inconsistency. Asserted so
    // that anyone who later misses a highlight finds the reasoning instead of
    // "adding it back".
    const body = src.slice(src.indexOf('void RE_Direct_Hapke('))
    const accumulation = body.slice(0, body.indexOf('#define RE_Direct'))
    expect(accumulation).to.not.contain('directSpecular')
    expect(accumulation).to.not.contain('BRDF_GGX')
  })

  it('shares one BRDF with the terrain, character for character', () => {
    // The point of the factories. If these two ever diverge, roads and ground
    // reflect light differently and nothing fails — it just looks like a
    // materials choice somebody made on purpose.
    const bodyOf = (s: string) => {
      const start = s.indexOf('float mu0 = dot(geometryNormal')
      return s.slice(start, s.indexOf('reflectedLight.directDiffuse', start))
    }
    const terrain = applyShaderPatches(lambert.fragmentShader, TERRAIN_FRAGMENT_PATCHES)
    expect(bodyOf(src)).to.equal(bodyOf(terrain))
    expect(bodyOf(src)).to.contain('hapkeReflectance(mu0, mu, cosG, acos(cosG))')
  })

  it('fills its shadows, so a road cannot go black where the ground does not', () => {
    expect(program).to.match(/uniform\s+float\s+bounceRadiance\s*;/)
    expect(src).to.contain('reflectedLight.indirectDiffuse += bounceRadiance * diffuseColor.rgb;')
  })

  it('keeps the maps and vertex colours the surface is authored with', () => {
    // Only the BRDF is replaced. The albedo map, the normal map that carries the
    // windrows and blade chatter, and the per-piece vertex tint all still have to
    // reach diffuseColor, or the roads lose the detail that makes them read as
    // built rather than drawn.
    //
    // Asserted on the UNRESOLVED source, since that is where include directives
    // still exist — resolveIncludes has replaced them with their bodies.
    expect(src).to.contain('#include <map_fragment>')
    expect(src).to.contain('#include <color_fragment>')
    expect(src).to.contain('#include <normal_fragment_maps>')
    // And they must run before the light loop that consumes diffuseColor.
    expect(src.indexOf('#include <map_fragment>')).to.be.lessThan(
      src.indexOf('#include <lights_fragment_begin>')
    )
  })

  it('does not double-count the albedo it is already given', () => {
    // diffuseColor arrives from map * color * vColor. Hapke's own single
    // scattering albedo is the SOIL's reflectance, so the material colours have to
    // stay near-neutral ratios rather than absolute darkness, and the accumulation
    // must multiply diffuseColor exactly once.
    const body = src.slice(src.indexOf('void RE_Direct_Hapke('))
    const accumulation = body.slice(0, body.indexOf('#define RE_Direct'))
    const uses = accumulation.match(/material\.diffuseColor/g) ?? []
    expect(uses.length).to.equal(1)
  })

  it('does not carry the terrain s uniforms, which it has no geometry for', () => {
    // The graded surfaces have their own normal maps in the map frame of the road,
    // not the patch. Declaring the terrain's uniforms here would compile and then
    // sample an unbound sampler.
    expect(src).to.not.contain('terrainNormalMap')
    expect(src).to.not.contain('detailSlopeMap')
    expect(src).to.not.contain('vTerrainWorldPos')
  })
})

// The stains are the one surface here that is deliberately not lit: they emit a
// multiplicative factor and let the blender apply it to ground that is already
// shaded. The failure mode is specific and silent — if the factor stops landing on
// exactly 1.0 where a stain is absent, every stain darkens or brightens the whole
// disc it is drawn on, including the part that should be untouched.
describe('stain patches against three s real Basic source', () => {
  const basic = ShaderLib.basic
  const src = applyShaderPatches(basic.fragmentShader, STAIN_FRAGMENT_PATCHES)

  it('applies cleanly', () => {
    expect(() => applyShaderPatches(basic.fragmentShader, STAIN_FRAGMENT_PATCHES)).to.not.throw()
  })

  it('is a no-op wherever the stain is absent', () => {
    // The whole correctness argument in one line: mix(vec3(1.0), ...) with a weight
    // of zero is exactly 1.0, and multiplying by 1.0 changes nothing. An
    // implementation that lerped toward the tone from anything other than white, or
    // that left alpha in the output, would tint the untouched ground.
    expect(src).to.contain('mix(vec3(1.0), diffuseColor.rgb, diffuseColor.a)')
    expect(src).to.contain('vec4(mix(vec3(1.0), diffuseColor.rgb, diffuseColor.a), 1.0)')
  })

  it('runs after the vertex colours it reads, and before the output', () => {
    // The factor and the fade both arrive through color_fragment: diffuseColor.rgb
    // is the albedo ratio from the vertex attribute and diffuseColor.a is
    // opacity * vertex alpha. Landing before that would read an unmultiplied
    // opacity and ignore the timeline entirely.
    const patch = src.indexOf('mix(vec3(1.0), diffuseColor.rgb')
    expect(patch).to.be.greaterThan(src.indexOf('#include <color_fragment>'))
    expect(patch).to.be.lessThan(src.indexOf('#include <opaque_fragment>'))
  })

  it('has no lighting in it, which is the point rather than an omission', () => {
    // A lit stain would shade against its own smooth geometric normal and average
    // away the per-pixel relief underneath it. If someone later "fixes" this by
    // reaching for the Hapke patches, this is where they find out why not.
    expect(src).to.not.contain('RE_Direct')
    expect(src).to.not.contain('hapkeReflectance')
    expect(src).to.not.contain('bounceRadiance')
  })

  it('leaves three s output colour space conversion alone', () => {
    // The factor must reach the blender in the same space as the destination.
    // Patching around colorspace_fragment — which an earlier draft did, to chase a
    // clamp that does not exist in this pipeline's half-float buffers — silently
    // changes what the multiply means.
    expect(src).to.contain('#include <colorspace_fragment>')
    const chunkCount = src.match(/#include <colorspace_fragment>/g) ?? []
    expect(chunkCount.length).to.equal(1)
    expect(src.slice(src.indexOf('#include <colorspace_fragment>'))).to.not.contain('gl_FragColor.rgb =')
  })
})
