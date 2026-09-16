# Technique catalog

Every sketch below assumes the standard local frame:

```glsl
vec2 uv = (fragCoord - 0.5 * iResolution) / iResolution.y;   // centered, aspect-correct, for radial/symmetric work
vec2 st = fragCoord / iResolution.xy;                          // 0..1, for grid/tiling/texture-sampling work
```

All sketches use only the uniforms and helper functions listed in `SKILL.md` — nothing here calls anything outside that contract. Treat each sketch as a starting point to bend toward the actual mutation being asked for, not a template to paste verbatim.

## Table of contents

Already well represented in `web/js/shaders/safe.js` — read the existing code rather than duplicating it here:
- **Domain warping** (`safe-drifting-strata`) — sample a noise field through a copy of itself, displaced by another noise field
- **Voronoi / cellular membranes** (`safe-cell-tide`) — animated cell seeds, membrane from second-nearest-minus-nearest
- **Volumetric raymarch** (`safe-slow-marches`) — short raymarch accumulating density through a noise volume
- **SDF composition** (`safe-geometric-signal`) — `smin`-blended primitives
- **Wave interference** (`safe-quiet-interference`) — summed wave sources at incommensurate frequencies
- **Layered parallax particles** (`safe-settling-dust`) — per-layer point sprites drifting at different rates

New families, detailed below:
1. [Kaleidoscopic symmetry](#1-kaleidoscopic-symmetry)
2. [Truchet tiles](#2-truchet-tiles)
3. [Reaction-diffusion (Gray-Scott) via uPrevFrame](#3-reaction-diffusion-gray-scott-via-uprevframe)
4. [Plasma](#4-plasma)
5. [Flow-field particle trails](#5-flow-field-particle-trails)
6. [Soft cellular automaton via uPrevFrame](#6-soft-cellular-automaton-via-uprevframe)
7. [Moiré (overlapping grids, distinct from wave interference)](#7-moiré-overlapping-grids)

---

## 1. Kaleidoscopic symmetry

Fold space into N wedges before sampling anything. Everything downstream — noise, palette, whatever — inherits the symmetry for free, which is what makes this read as "a kaleidoscope" rather than "noise with a twist."

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - 0.5 * iResolution) / iResolution.y;
  float folds = 5.0 + floor(uSeason * 5.0);           // 5..10-fold, drifts with the season
  float wedge = 6.28318 / folds;

  float ang = atan(uv.y, uv.x) + iTime * 0.03;
  float rad = length(uv);
  ang = mod(ang, wedge);
  ang = abs(ang - wedge * 0.5);                        // mirror within the wedge: fold, don't just repeat
  vec2 kuv = vec2(cos(ang), sin(ang)) * rad;

  float field = fbm(kuv * 3.0 + rad * 1.5 - iTime * 0.05);
  float rings = 0.5 + 0.5 * sin(rad * 14.0 - iTime * 0.6 + field * 3.0);
  float value = smoothstep(0.15, 0.9, mix(field, rings, 0.4 + 0.2 * uRainIntensity));

  vec3 color = palette(
    value * 0.7 + rad * 0.2 + uTimeOfDay * 0.3,
    vec3(0.14, 0.10, 0.16), vec3(0.4, 0.3, 0.45), vec3(1.0, 0.9, 1.1), vec3(0.15, 0.35, 0.55)
  );
  color *= 0.25 + 0.85 * value;
  fragColor = vec4(color, 1.0);
}
```

Vary `folds` with a different uniform (crowd density, wind) to make the symmetry itself an environmental response. Odd fold counts (5, 7, 9) read as less mechanical than even ones.

## 2. Truchet tiles

A grid where each cell independently picks one of two arc orientations. The interest is entirely in what connects to what across cell boundaries — no per-cell randomness beyond that one bit is needed.

```glsl
float truchetArcs(vec2 p, float flip) {
  // p is local cell space, roughly [-0.5, 0.5]. Two quarter-circle arcs,
  // mirrored by `flip`, that always meet the cell's edge midpoints.
  vec2 c1 = flip > 0.5 ? vec2(-0.5, -0.5) : vec2(-0.5, 0.5);
  vec2 c2 = flip > 0.5 ? vec2(0.5, 0.5) : vec2(0.5, -0.5);
  float d1 = abs(length(p - c1) - 0.5);
  float d2 = abs(length(p - c2) - 0.5);
  return min(d1, d2);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - 0.5 * iResolution) / iResolution.y;
  float scale = 5.0 + floor(uCrowdDensity * 4.0);
  vec2 grid = uv * scale + vec2(iTime * 0.015, -iTime * 0.01);
  vec2 cell = floor(grid);
  vec2 local = fract(grid) - 0.5;

  float flip = step(0.5, hash12(cell));
  float line = truchetArcs(local, flip);
  float mask = smoothstep(0.05, 0.0, line - 0.02 * sin(iTime * 0.4 + hash12(cell) * 20.0));

  float field = fbm(uv * 1.5 + iTime * 0.02);
  vec3 color = palette(
    field * 0.4 + mask * 0.5 + uTimeOfDay * 0.3,
    vec3(0.10, 0.12, 0.14), vec3(0.3, 0.32, 0.3), vec3(1.0, 1.0, 0.9), vec3(0.2, 0.4, 0.5)
  );
  color = mix(color * 0.35, color, mask);
  fragColor = vec4(color, 1.0);
}
```

The `sin(iTime * 0.4 + hash * 20.0)` term on the mask threshold makes individual arcs pulse out of phase with each other — without it the grid is static except for the slow pan, which reads as flat.

## 3. Reaction-diffusion (Gray-Scott) via uPrevFrame

The real thing, not an approximation of it — two chemicals packed into the red and green channels of the single feedback buffer, updated by a 4-tap Laplacian (a diffusion pass no full ping-pong array or loop can give you here, but a 4-neighbor stencil is enough to read as organic growth). This is the technique behind essentially all "reaction-diffusion" generative art you've seen; it survives the one-sampler constraint because Gray-Scott only ever needs a cell's four immediate neighbors, not a wide blur kernel.

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 px = 1.0 / iResolution.xy;

  vec2 center = texture(uPrevFrame, uv).rg;
  vec2 sum = texture(uPrevFrame, uv + vec2(px.x, 0.0)).rg
           + texture(uPrevFrame, uv - vec2(px.x, 0.0)).rg
           + texture(uPrevFrame, uv + vec2(0.0, px.y)).rg
           + texture(uPrevFrame, uv - vec2(0.0, px.y)).rg;
  vec2 laplacian = sum - 4.0 * center;

  float a = center.r;
  float b = center.g;
  float reaction = a * b * b;
  float feed = 0.034 + 0.01 * uTemperature;
  float kill = 0.062 + 0.008 * uSeason;

  // The feedback buffer is 8-bit per channel here, not float. The textbook
  // Gray-Scott dt of 1.0 overshoots the explicit-diffusion stability limit
  // at that precision — verified against this project's real FeedbackBuffer,
  // dt=1.0 blows the whole frame up into RGB static within about 5 seconds.
  // A smaller step stays within what 256 levels per channel can represent.
  float dt = 0.35;
  float newA = clamp(a + dt * (1.0 * laplacian.r - reaction + feed * (1.0 - a)), 0.0, 1.0);
  float newB = clamp(b + dt * (0.5 * laplacian.g + reaction - (kill + feed) * b), 0.0, 1.0);

  // A slow trickle of inhibitor near center so a cold-started (unseeded,
  // effectively black) buffer has something to grow from, and a quiet run
  // never fully starves out to a dead, unchanging field.
  float seed = smoothstep(0.35, 0.0, length(uv - 0.5)) * step(mod(iTime, 5.0), 0.08);
  newB = clamp(newB + seed * 0.6, 0.0, 1.0);

  vec3 color = palette(
    newA - newB * 0.6 + uTimeOfDay * 0.2,
    vec3(0.10, 0.09, 0.13), vec3(0.45, 0.4, 0.5), vec3(1.0, 1.0, 1.0), vec3(0.05, 0.2, 0.35)
  );
  fragColor = vec4(color, 1.0);
}
```

`feed`/`kill` are the two constants that decide whether this settles into spots, stripes, or a slowly spreading maze — the values above sit in the "coral/spots" regime. Nudge `feed` down and `kill` up for finer, more maze-like structure; the reverse gives fewer, larger blobs.

**`dt` is load-bearing, not decorative.** `clamp()` alone does not make this stable — it keeps every value inside [0,1], but a clamped value can still oscillate wall-to-wall every frame, which reads as solid RGB static, not as reaction-diffusion. The instability comes from combining the textbook `dt=1.0` with an 8-bit-per-channel feedback buffer (this project's `FeedbackBuffer` uses `RGBA8`, not a float format): forward-Euler diffusion is only stable when roughly `diffusionRate * dt <= 0.25` on a 4-neighbor stencil, and at `dt=1.0` with `Da=1.0` that bound is blown by 4x. Confirmed by actually running this against the real renderer — at `dt=1.0` the whole frame degenerates into colorful noise within about 5 seconds; at `dt=0.35` it settles into a stable, slowly evolving pattern indefinitely. If a future tweak to `FeedbackBuffer` adds a float-precision option, this constraint loosens and `dt` can come back up toward 1.0 — until then, keep it well under the stability bound and verify over at least 20-30 seconds (see `verification.md`), not just the first couple of frames, since instability here takes several seconds to become visible.

## 4. Plasma

The oldest demoscene trick there is: sum a handful of sine waves at different frequencies and axes, then push the sum through a palette. Cheap, and it reads as a completely different visual register from anything noise-based — smoother, more electric.

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - 0.5 * iResolution) / iResolution.y;
  float t = iTime * 0.15 + uTimeOfDay * 1.5;

  float v = sin(uv.x * 6.0 + t);
  v += sin(uv.y * 5.0 - t * 1.3);
  v += sin((uv.x + uv.y) * 4.0 + t * 0.7 + uWind * 2.0);
  v += sin(length(uv) * 8.0 - t * 1.6);
  v *= 0.25;

  float grain = fbm(uv * 2.0 + t * 0.1) * 0.15 * uRainIntensity;
  vec3 color = palette(
    v * 0.5 + 0.5 + grain,
    vec3(0.15, 0.1, 0.2), vec3(0.5, 0.4, 0.5), vec3(1.2, 1.0, 0.8), vec3(0.0, 0.25, 0.5)
  );
  fragColor = vec4(color, 1.0);
}
```

Plasma is easy to overdo into "generic rainbow gradient" — keep the `palette()` vectors close together (not full saturation across all three RGB phases) so it reads as this project's restrained aesthetic rather than a screensaver.

## 5. Flow-field particle trails

A handful of particles (an unrolled `for` loop over a fixed, small count — never a growing/simulated array) each following a deterministic curl-like flow, depositing light into the self-feedback buffer as they move. Distinct from `safe-settling-dust`'s static layered points: these actually travel and leave a fading trail behind them, which needs `uPrevFrame`.

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 centered = (fragCoord - 0.5 * iResolution) / iResolution.y;

  vec3 prev = texture(uPrevFrame, uv).rgb * 0.965;   // bounded decay — see Self-feedback in SKILL.md

  vec3 deposit = vec3(0.0);
  for (int i = 0; i < 20; i++) {
    float fi = float(i);
    float seed = hash11(fi + 4.0);
    float angle = fbm(centered * 1.4 + seed * 12.0 + iTime * 0.04) * 12.566
      + uWind * 3.0;
    float radius = mod(iTime * (0.12 + 0.08 * seed) + seed * 4.0, 1.1);
    vec2 pos = vec2(cos(seed * 6.283), sin(seed * 6.283)) * 0.5
      + vec2(cos(angle), sin(angle)) * radius * 0.4;
    float d = length(centered - pos);
    deposit += smoothstep(0.018, 0.0, d)
      * palette(seed, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.33, 0.67));
  }

  fragColor = vec4(clamp(prev + deposit * 0.5, 0.0, 1.0), 1.0);
}
```

20 particles is a loop bound comfortably inside the 256 limit; raise it only if a budget check (see `references/verification.md`) confirms there's room.

## 6. Soft cellular automaton via uPrevFrame

A continuous, softened relative of Conway's Game of Life rather than a literal implementation — crisp per-pixel automata do not survive `smoothstep` blending or float precision well on a large canvas, and a soft version reads better on signage anyway (no single-pixel flicker). Coarse cells are read from the feedback buffer at a fixed spacing so each "cell" spans many real pixels.

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 cellSize = 16.0 / iResolution.xy;
  vec2 cell = (floor(uv / cellSize) + 0.5) * cellSize;

  float self = texture(uPrevFrame, cell).r;
  float n = 0.0;
  n += texture(uPrevFrame, cell + vec2(cellSize.x, 0.0)).r;
  n += texture(uPrevFrame, cell - vec2(cellSize.x, 0.0)).r;
  n += texture(uPrevFrame, cell + vec2(0.0, cellSize.y)).r;
  n += texture(uPrevFrame, cell - vec2(0.0, cellSize.y)).r;
  n += texture(uPrevFrame, cell + cellSize).r;
  n += texture(uPrevFrame, cell - cellSize).r;
  n += texture(uPrevFrame, cell + vec2(cellSize.x, -cellSize.y)).r;
  n += texture(uPrevFrame, cell + vec2(-cellSize.x, cellSize.y)).r;

  float alive = step(0.5, self);
  float survive = alive * smoothstep(1.4, 2.0, n) * smoothstep(3.6, 3.0, n);
  float birth = (1.0 - alive) * smoothstep(2.6, 3.0, n) * smoothstep(3.4, 3.0, n);
  float next = clamp(survive + birth, 0.0, 1.0);

  // Without an occasional reseed a soft automaton on a finite grid tends to
  // either die out or freeze into a static pattern within a minute or two.
  float reseed = step(0.996, hash12(floor(uv / cellSize) + floor(iTime * 0.25)));
  next = clamp(next + reseed, 0.0, 1.0);

  vec3 color = palette(
    next + uTimeOfDay * 0.15,
    vec3(0.08, 0.09, 0.08), vec3(0.4, 0.45, 0.4), vec3(1.0), vec3(0.1, 0.3, 0.2)
  );
  fragColor = vec4(color * (0.15 + 0.85 * next), 1.0);
}
```

## 7. Moiré (overlapping grids)

Different from `safe-quiet-interference`'s wave sources: two independent line/dot grids at a slight angle or scale offset to each other, multiplied or subtracted together. The beating pattern that emerges is purely geometric, which gives it a harder, more optical-illusion character than wave interference's soft ripples.

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - 0.5 * iResolution) / iResolution.y;

  float angleA = 0.0;
  float angleB = 0.12 + 0.05 * sin(iTime * 0.05) + uWind * 0.03;   // near-parallel, drifting apart
  vec2 a = rotate2D(angleA) * uv * (18.0 + uCrowdDensity * 6.0);
  vec2 b = rotate2D(angleB) * uv * (18.0 + uCrowdDensity * 6.0);

  float gridA = 0.5 + 0.5 * sin(a.x) * sin(a.y);
  float gridB = 0.5 + 0.5 * sin(b.x + iTime * 0.1) * sin(b.y - iTime * 0.1);
  float moire = gridA * gridB;

  float field = fbm(uv * 1.2 + iTime * 0.02) * 0.2;
  vec3 color = palette(
    moire * 0.8 + field + uTimeOfDay * 0.25,
    vec3(0.09, 0.09, 0.11), vec3(0.35), vec3(1.0, 1.0, 0.95), vec3(0.15, 0.3, 0.45)
  );
  fragColor = vec4(color * (0.2 + 0.85 * moire), 1.0);
}
```

Keep `angleB` close to `angleA` (a few degrees to ~15°) — moiré needs near-alignment to beat visibly; a large angle just looks like two overlapping grids instead of one interfering pattern.
