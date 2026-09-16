# Verifying a shader before calling it done

A shader that looks right by eye-reading the GLSL is not verified — compile errors, frame-budget overruns, and "renders solid black" mistakes are common and easy to miss on paper. Pick whichever path is available.

## Path A: a running dev server + browser (preferred)

This runs the exact production validation path — the same `validateCandidate()` Guardian call a real LLM-produced candidate goes through, including the frame-budget timing and (for anything using `uPrevFrame`) the sequential feedback probe.

1. Start the server if one isn't already running: `MOCK_LLM=1 PORT=8000 node server/index.js` (background it).
2. Open `http://localhost:8000/?debug=1` in a browser (or reuse an already-open tab/session).
3. In the page console, or via a browser automation tool's JS-execution capability, run:
   ```js
   await window.__signage.injectCandidate(`
   void mainImage(out vec4 fragColor, in vec2 fragCoord) {
     ...
   }
   `)
   ```
4. Read the returned report: `{ ok, stage, reasons, metrics }`. `stage: "static"` means a banned construct; `"compile"` means a GLSL error (the reason string includes the driver's error text and the offending line); `"sample"` means it renders too dark/bright/flat or (for `uPrevFrame` candidates) is diverging; `"timing"` means it blew the frame budget.
5. If `ok: true`, the candidate becomes current via a real crossfade — watch it for at least one full transition (`cycleConfig.transition_sec`, default 10s) to see the actual result, and for anything using `uPrevFrame`, watch for another 10-20 seconds after that so accumulation has time to show its actual behavior, not just its first frame.

`window.__signage.state()` also has `lastReport` if you need to re-read the last result, and `currentBody()` returns the shader now on screen.

## Path B: scratch Playwright + SwiftShader (no browser session available)

Use this when no interactive browser is reachable. Set up once in the session's scratchpad (never `/tmp`):

```bash
mkdir -p <scratchpad>/pw && cd <scratchpad>/pw
npm init -y && npm i playwright@1
npx playwright install chromium
```

Then drive it with a script along these lines — launch with SwiftShader flags, navigate to a running dev server, call `injectCandidate`, and read back the report:

```js
import { chromium } from "playwright";
const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
});
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
await page.goto("http://127.0.0.1:8000/?debug=1&clock=fast", { waitUntil: "load" });
await page.waitForFunction(() => window.__signage?.injectCandidate);
const report = await page.evaluate((body) => window.__signage.injectCandidate(body), SHADER_BODY);
console.log(report);
// screenshots: await page.screenshot({ path: "<scratchpad>/....png" })
```

SwiftShader is a *software* rasterizer — an order of magnitude slower per pixel than any real GPU. The project's frame budget (`config/runtime.json`'s `runtime.frame_budget_ms`, default 24) is calibrated against real hardware, so a perfectly reasonable shader can fail the timing stage here for reasons that will never happen on the actual signage display. If that's the only failure, either accept it as a false negative from the software renderer, or temporarily raise `frame_budget_ms` in `config/runtime.json` for the verification run and **restore it afterward** — never leave the raised value committed.

Kill the server and delete scratch files (screenshots, the Playwright install) when done; they don't belong in the repo or in `/tmp`.

## What "good" looks like once it's rendering

Beyond `ok: true`, actually look at it:
- Does it read as the specific technique it's supposed to be (a kaleidoscope should look foldable at a glance), or has it drifted into the same generic noise-field look everything else already has?
- Does the `mutateGuidance`/environment response make sense, or is every uniform just nudging a coefficient with no visible effect?
- For a `uPrevFrame` shader specifically: does it still look reasonable after 30-60 seconds, not just in the first few? A slow drift toward white/black that Guardian's ~3-second probe didn't catch is a known gap (see `specs/2026-09-08-feedback-buffer.md` Risks) — this is exactly the kind of thing manual observation catches that the automated gate cannot.
