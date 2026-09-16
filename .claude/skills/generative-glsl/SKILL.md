---
name: generative-glsl
description: Write or improve GLSL fragment shaders for AI Artist Signage — especially the bundled "Safe Shader" fallbacks in web/js/shaders/safe.js — with real generative-art technique (domain warping, Voronoi, raymarching, SDF composition, reaction-diffusion, kaleidoscopic symmetry, Truchet tiles, moiré/interference, flow-field trails, plasma, cellular automata), not seven variations on the same dim fbm haze. Also use this to review or critique an LLM-generated shader candidate for genuine technique/visual variety, or when someone says the bundled shaders / boot shaders / fallback shaders look samey, boring, or lack generative-art literacy. Always consult this before hand-writing a shader for this project — it encodes the project's Shader Contract (which uniforms and helper functions exist, what GLSL constructs are banned, why the loop and texture rules exist) so the result compiles on the first try and reads as a specific, recognizable technique rather than a generic noise field.
---

# Generative GLSL for AI Artist Signage

This project's shaders are not free-form Shadertoy code — they run inside a specific contract, and the payoff of following it precisely is that a shader written to spec compiles and passes Guardian on the first try instead of bouncing through several rejected attempts. This skill exists because the seven bundled Safe Shaders (`web/js/shaders/safe.js`) — the fallbacks shown at boot and on WebGL context loss — already use legitimate techniques (domain warping, Voronoi, a short raymarch, SDF composition, wave interference, layered parallax) but converge on the same visual register: dim, cool-toned, mid-density fbm fields with a `palette()` gradient. Seven pieces from the same aesthetic family read as one piece repeated, not seven. The fix is not "add more noise" — it's picking techniques whose *symmetry, palette logic, and spatial organization* are actually different from each other, the way a real gallery hang mixes a grid piece next to a fluid piece next to a particle piece.

## The contract (read this before writing anything)

The body you write is inserted between a fixed prelude and epilogue — write only helper functions plus exactly one:

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) { ... }
```

**Never write**: `#version`, `precision`, any `uniform`/`varying`/`attribute`/`layout` declaration, `while`, `do`, `switch`, `gl_FragColor`, `void main(`. A `for` loop's bound must be a literal number (not a variable) no larger than 256, and loops may nest at most 2 deep (3+ nested `for` loops is rejected). Explicit `in`/`out` qualifiers on your own helper function parameters are safest avoided — match the existing bundled shaders' style of plain-typed parameters.

**Uniforms available** (declared for you, just reference by name):
```glsl
iTime iResolution iFrame
uTimeOfDay uDayOfYear uSeason uTemperature uRainIntensity
uWind uAmbientLight uCrowdDensity uSoundLevel
uPrevFrame   // sampler2D — see "Self-feedback" below
```
`iTime` resets to 0 whenever this shader becomes current (a crossfade or boot), so absolute clock behavior belongs on `uTimeOfDay`/`uDayOfYear`, not `iTime`.

**Helper functions available**, exact signatures, no overloads:
```glsl
float hash11(float p)      float hash12(vec2 p)      vec2 hash22(vec2 p)
float noise(vec2 p)        float noise3(vec3 p)
float fbm(vec2 p)          float fbm3(vec3 p)         // fixed 5 octaves, no argument for count
vec3  palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) // all 5 args required
mat2  rotate2D(float radians)
float sdCircle(vec2 p, float r)   float sdBox(vec2 p, vec2 halfSize)   float sdSegment(vec2 p, vec2 a, vec2 b)
float smin(float a, float b, float k)
```
Define any other helper yourself (as in the raymarch example below, which writes its own `volumeAt`).

**Visibility rules**: never fully black or a single flat colour, and light/structure must keep varying at t=0, t=7, and t=61 seconds — a shader that only "wakes up" after 60 seconds reads as dead for the first minute. Keep it dark and quiet by all means; never empty.

**Frame budget**: judged against roughly 24ms at 1080p, scaled to actual resolution — a short raymarch (12–20 steps) is fine, a naive 256-step one is not. If a technique wants more steps than the budget allows, reduce iteration count and lean on `smoothstep`/blending to sell depth rather than sampling density.

For the full technique catalog — domain warping, Voronoi, raymarching, SDF composition, reaction-diffusion/trails via `uPrevFrame`, kaleidoscopic symmetry, Truchet tiles, interference/moiré, flow-field particle trails, plasma, cellular automata — each with a working sketch already fitted to these constraints, read `references/techniques.md`. Skim its table of contents and open only the technique(s) actually relevant to the current task; you don't need to read the whole file for a one-line tweak.

## Self-feedback (`uPrevFrame`)

`uPrevFrame` is this shader's own previous rendered frame, read-only, sampled as `texture(uPrevFrame, fragCoord / iResolution)`. It is the one thing that persists across frames — everything else about a shader here is a pure function of `iTime` and the environment uniforms. Use it for anything that should accumulate: trails, reaction-diffusion, slow decay, motion blur, growth.

The one rule that matters: **whatever you write back through `uPrevFrame` must be bounded**, or it silently drifts to solid white or solid black over the following seconds. Concretely:
- Any term that multiplies the previous frame needs a decay factor strictly less than 1 (`prev.rgb * 0.94`, not `prev.rgb * 1.02`) unless it's paired with an explicit `clamp()`.
- Adding a small constant every frame (an "ambient floor") without also decaying compounds forever — it will eventually saturate to white exactly like a runaway multiplier does. If you want a floor, derive it from something bounded (e.g. `mix(decayed, floor, 0.05)`), not an unconditional per-frame addition.
- A shader that reads `uPrevFrame` becomes current with its buffer seeded from whatever was on screen a moment before (an accepted mutation inherits the outgoing work's last frame; the very first program the runtime is ever given opens on an unseeded, effectively black buffer) — so also draw *something* every frame independent of `uPrevFrame`, so the piece isn't just a black frame slowly deciding what it is.

This project's own Guardian runs a candidate that uses `uPrevFrame` forward for ~180 simulated frames before judging it, checking whether luminance is still trending toward an extreme by the end — so an unbounded feedback loop will usually be caught before it ever reaches the display. Still, write it bounded on purpose rather than relying on that safety net to catch a mistake.

The feedback buffer is **8-bit per channel**, not float. `clamp()` keeps a value inside range, but a value that's merely clamped can still oscillate wall-to-wall every frame and read as solid colored static rather than the intended pattern — this bit a first draft of the reaction-diffusion technique below hard enough that it's worth stating plainly: any update rule that combines multiple neighboring texel reads (diffusion, blur, cellular automata) needs a small explicit `dt` factor well under the naive-textbook value, verified by actually watching it for 20-30 seconds, not just the first couple of frames. See the "`dt` is load-bearing" note in `references/techniques.md`'s reaction-diffusion section for the concrete numbers and why.

## Designing a set, not a single piece

When asked to rewrite the bundled Safe Shaders (or add to them), the unit of work is the *set*, not any one file. Before finalizing a shader, check it against its siblings on three axes:

1. **Symmetry / spatial organization** — radial vs. grid vs. free-flowing vs. layered-depth vs. cellular. Two pieces sharing the same organizing principle (e.g. two different fbm flow fields) will read as the same piece even with different palettes.
2. **Palette logic** — the four `palette()` vectors control the whole mood. Vary the phase/frequency vector (`c`, `d`) enough that pieces don't all land on the same blue-dominant, low-saturation register; try a warm piece, a near-monochrome piece, a high-contrast piece.
3. **Density/rhythm** — a piece that's mostly calm negative space against one that's densely detailed everywhere reads as different even at a glance, before you look at technique at all.

A good set of seven should be nameable at a glance the way a room of paintings is: "the raymarched fog one," "the Voronoi membranes one," "the kaleidoscope one," "the Truchet grid one" — not "the noise ones."

## Verifying a candidate

Never hand off a shader you haven't seen render. Read `references/verification.md` for the two supported paths: `window.__signage.injectCandidate(body)` against a running dev server (fastest, and it's the exact production validation path — Guardian included), or a scratch Playwright + SwiftShader script when no server/browser is available. Both let you catch a compile error or a Guardian rejection (frame budget, darkness, staying flat) before calling the work done.
