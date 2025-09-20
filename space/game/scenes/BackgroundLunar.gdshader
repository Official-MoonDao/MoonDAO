shader_type canvas_item;

/* -------- runtime params from script -------- */
uniform vec2  u_view_size   = vec2(800.0, 450.0);
uniform vec2  u_offset      = vec2(0.0, 0.0);
uniform float u_time        = 0.0;

/* -------- textures -------- */
uniform sampler2D albedo_tex  : source_color;
uniform sampler2D normal_tex  : hint_normal;   // RGB=normal, A=height

/* -------- tiling / scale -------- */
uniform float u_tile_px   = 256.0;   // baked tile size in pixels
uniform float u_uv_scale  = 0.65;    // <1 = bigger craters/features

/* -------- pixel look (optional) -------- */
uniform vec2  u_pixel_res = vec2(320.0, 180.0);

/* -------- parallax -------- */
uniform float height_scale = 0.012;
uniform float steps_base   = 30.0;
uniform float steps_max    = 90.0;
uniform vec3  view_dir_ts  = vec3(0.0, 0.0, 1.0);

/* -------- lighting -------- */
uniform vec3  light_dir_ss = vec3(-0.55, -0.32, 1.0);
uniform float light_strength = 0.55;
uniform float cL_bias        = 0.85;
uniform float cL_scale       = 0.010;
uniform float normal_strength = 1.1;

/* -------- tone -------- */
uniform vec4  albedo_tint   : source_color = vec4(0.72, 0.74, 0.79, 1.0);
uniform float exposure       = 0.88;
uniform float contrast       = 0.95;

/* -------- NEW: anti-tiling controls -------- */
uniform float at_strength = 0.55;   // 0..1: how strong blending of UV variants is
uniform float at_scale    = 0.75;   // 0..2: noise scale controlling blend pattern
uniform float at_variants = 3.0;    // 2..4: how many variants to mix (perf vs quality)

/* ---------- helpers: noise / hash ---------- */
float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }

float noise(vec2 p){
	vec2 i = floor(p), f = fract(p);
	float a = hash(i);
	float b = hash(i + vec2(1,0));
	float c = hash(i + vec2(0,1));
	float d = hash(i + vec2(1,1));
	vec2 u = f*f*(3.0-2.0*f);
	return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}

float fbm(vec2 p){
	float v=0.0, a=0.5;
	for (int i=0;i<5;i++){ v+=a*noise(p); p*=2.02; a*=0.5; }
	return v;
}

/* ---------- parallax (same as before) ---------- */
float sample_height(vec2 uv){
	float a = texture(normal_tex, uv).a;
	return (0.5 - a) * height_scale;
}

vec2 parallax_interstep_mapping(vec2 uv, vec3 vdir_ts){
	float nsteps   = min(steps_base / max(0.00001, vdir_ts.z), steps_max);
	float stepsize = height_scale / steps_base;
	vec3 mover = vec3(uv, 0.0);
	float height = sample_height(mover.xy);
	float prev_h = 0.0;
	float sdir   = sign(height);
	vec3 dview   = sdir * vdir_ts * stepsize;
	float weight = 0.0;
	int N = int(clamp(floor(nsteps), 1.0, 200.0));
	for (int i=0;i<N;i++){
		if (sdir * (mover.z - height) > 0.0){
			float denom = dview.z + prev_h - height;
			if (abs(denom) > 1e-6) weight = (mover.z - height) / denom;
			break;
		}
		mover += dview;
		prev_h = height;
		height = sample_height(mover.xy);
	}
	return mover.xy - dview.xy * weight;
}

/* ---------- tone & lighting ---------- */
vec3 tone(vec3 c){
	c = (c - 0.5) * contrast + 0.5;
	c *= exposure;
	return clamp(c, 0.0, 1.0);
}

vec3 apply_lighting(vec3 albedo, vec3 n_ts, vec3 vdir_ts){
	vec3 N = normalize(mix(vec3(0,0,1), n_ts, normal_strength));
	vec3 L = normalize(light_dir_ss);
	vec3 V = normalize(vdir_ts);
	float ndotl = max(dot(N,L), 0.0);
	float ndotv = max(dot(N,V), 0.0);
	float edotl = clamp(dot(V,L), -1.0, 1.0);
	float cL = cL_bias - cL_scale * acos(edotl);
	float denom = max(ndotl + ndotv, 1e-4);
	float brdf  = ndotl * (2.0 * cL / denom + (1.0 - cL));
	return albedo * (1.0 + light_strength * brdf);
}

/* ---------- NEW: anti-tiling sampler ---------- */
mat2 rot(float a){
    float s = sin(a), c = cos(a);
    return mat2(vec2(c, s), vec2(-s, c));  // ✅ Godot wants column-major
}

void sample_albedo_normal(vec2 uv_base, out vec3 albedo, out vec3 n_ts){
	// Base sample (wrapped)
	vec2 uv0 = fract(uv_base);
	vec3 a0 = texture(albedo_tex, uv0).rgb;
	vec3 n0 = texture(normal_tex, uv0).rgb * 2.0 - 1.0;

	// If no anti-tiling, return base
	if (at_strength <= 0.001 || at_variants < 2.0){
		albedo = a0;
		n_ts   = n0;
		return;
	}

	// Build up to 3 extra variants: rotated/mirrored/offset
	vec2 cell   = floor(uv_base);
	float rseed = hash(cell);

	// Variant 1: rotate ~30° and offset by hashed amount
	vec2 uv1 = uv_base * rot(0.52 + rseed*0.7) + vec2(hash(cell+3.1), hash(cell+6.7));
	uv1 = fract(uv1);
	vec3 a1 = texture(albedo_tex, uv1).rgb;
	vec3 n1 = texture(normal_tex, uv1).rgb * 2.0 - 1.0;

	// Variant 2: mirror X then rotate ~-20°
	vec2 uv2 = vec2(1.0 - fract(uv_base.x), fract(uv_base.y));
	uv2 = (uv2 - 0.5) * rot(-0.35 + rseed*0.4) + 0.5;
	uv2 = fract(uv2);
	vec3 a2 = texture(albedo_tex, uv2).rgb;
	vec3 n2 = texture(normal_tex, uv2).rgb * 2.0 - 1.0;

	// Variant 3 (optional): small scale jitter + offset
	vec2 uv3 = (uv_base * (1.0 + (hash(cell+9.9)-0.5)*0.15)) + vec2(0.31, 0.17);
	uv3 = fract(uv3);
	vec3 a3 = texture(albedo_tex, uv3).rgb;
	vec3 n3 = texture(normal_tex, uv3).rgb * 2.0 - 1.0;

	// Weights driven by low-freq FBM to make irregular patches
	vec2 wpos = (cell + fract(uv_base)) * at_scale;
	float w0 = 1.0 - at_strength + at_strength * fbm(wpos + 0.00);
	float w1 = at_strength * fbm(wpos + 7.13);
	float w2 = at_strength * fbm(wpos + 3.71);
	float w3 = at_strength * fbm(wpos + 11.9);

	// Limit number of variants if requested
	if (at_variants < 4.0){ w3 = 0.0; }
	if (at_variants < 3.0){ w2 = 0.0; }

	// Normalize
	float ws = max(w0 + w1 + w2 + w3, 1e-5);
	w0/=ws; w1/=ws; w2/=ws; w3/=ws;

	albedo = a0*w0 + a1*w1 + a2*w2 + a3*w3;
	n_ts   = normalize(n0*w0 + n1*w1 + n2*w2 + n3*w3);
}

void fragment(){
	// pixel-stable screen UV
	vec2 view = max(u_view_size, vec2(1.0));
	vec2 suv  = FRAGCOORD.xy / view;
	vec2 puv  = (floor(suv * u_pixel_res) + 0.5) / u_pixel_res;

	// World scroll in pixels
	vec2 world = u_offset + puv * u_view_size;

	// Base tiled UV in texture space
	vec2 uv_base = (world / u_tile_px) * u_uv_scale;

	// Parallax in texture space (apply to base UV)
	vec2 uv_para = parallax_interstep_mapping(fract(uv_base), view_dir_ts);
	// Shift base by the parallax delta computed in [0..1] space
	vec2 delta = uv_para - fract(uv_base);
	vec2 uv_for_anti = uv_base + delta;

	// Anti-tiling sampling (blends multiple rotated/offset variants)
	vec3 alb, nrm_ts;
	sample_albedo_normal(uv_for_anti, alb, nrm_ts);

	// Tint, light, tone
	vec3 lit = apply_lighting(alb * albedo_tint.rgb, nrm_ts, view_dir_ts);
	COLOR = vec4(tone(lit), 1.0);
}
