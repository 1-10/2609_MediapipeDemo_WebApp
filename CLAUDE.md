# CLAUDE.md

## Role

Claude acts as:

- Feature Architect
- Task Orchestrator
- Issue Manager (optional, for complex features)

NOT as primary implementer.

---

## Tech Stack Context

- Product: MediaPipe Demo App — Webカメラ映像をMediaPipeでリアルタイム解析し、
  (1) 映像抽象度比較 (Mode 1: silhouette / face mosaic / face detection overlay の
  3ペイン同時表示) と (2) セマンティック通信 (Mode 2: Object Detector →
  SemanticPacket → テンプレートprompt → Hugging Face Text-to-Image による再構成)
  を切り替え体験できる展示用デモアプリ
- Design docs (実装時はこれらが正):
  `specs/00_overview.md`, `specs/10_mode1_abstraction_comparison.md`,
  `specs/11_mode2_semantic_communication.md`,
  `specs/20_architecture_and_acceptance.md`
- Runtime: Node.js ≥ 22、ES modules、バンドラなし。Pythonは使わない
- Renderer: `web/` — Vanilla JS / HTML / Canvas2D。ブラウザへバンドルなしで直接
  ロードされる。MediaPipe推論は `@mediapipe/tasks-vision` を使用し、
  `web/vendor/tasks-vision/`（`scripts/copy-vendor.mjs` で `node_modules` から
  コピーする生成物。手編集禁止）から `FilesetResolver` / `FaceDetector` /
  `ObjectDetector` / `ImageSegmenter` をESM importする。モデル資産(`.tflite`)は
  `storage.googleapis.com/mediapipe-models/...` の絶対URLを参照する
- Backend: `server/`（`node:http`、フレームワーク不使用）—
  `web/` の静的配信、`config/app.config.json` の配信、
  `POST /api/generate-image`（Hugging Face Inference Providers
  text-to-imageへのプロキシ。`@huggingface/inference` 使用。
  生成concurrency上限1・最新state優先coalescing）。開発時は `npm run dev`
- Shared: `shared/types.js`（FrameContext, SemanticPacket,
  ImageGenerator interface等のJSDoc型。renderer/backend共用、実行時依存なし）
- Config: `config/app.config.json`（camera解像度・各種threshold・
  mosaicパラメータ・画像生成モデル名等。コード中にハードコードしない）
- Secrets: `.env`（`HF_TOKEN`, `PORT`）— サーバー側のみ。
  `web/` 配下のいかなるファイルにもトークンを書かない・fetchしない
- Hard rules（非交渉。詳細は `specs/20_architecture_and_acceptance.md` §10）:
  1. Webカメラ入力は1系統のみ、複数処理へ分岐
  2. Mode 1 中央（モザイク）・右（検出UI）でFace Detector推論を共有し、
     2重実行しない（実行主体は `Mode1Controller`）
  3. Mode 2はカメラ画像そのものを画像生成APIへ送らない。送るのは
     SemanticPacketから生成したtext promptのみ
  4. HF TokenはブラウザJSへ一切露出しない
  5. Mode 2の画像生成requestは同時1件まで。生成中の新しいsemantic stateは
     queueに積まず、最新のみ保持
  6. 画像生成の実装は `ImageGenerator` interfaceのAdapterとして隔離する
     （`server/generation/HuggingFaceImageGenerator.js`）
  7. モデル名・主要thresholdは `config/app.config.json` で変更可能にする
  8. 展示用UIとdebug UI（`?debug=true`）を分離する
- Working branch base: `main`

---

## Workflow Modes

### Mode A: Spec → Direct Delegation (recommended)

```
Feature Request
    ↓
[/web-feature-spec] → /specs/<date>-<name>.md
    ↓
[/cmux-delegate] → Codex worker implements from spec
    ↓
PR to main → review → merge
```

Use when: Single concern, clear scope, 1–2 workers sufficient.

### Mode B: Spec → Issues → Parallel Delegation

```
Feature Request
    ↓
[/web-feature-spec] → /specs/<date>-<name>.md
    ↓
[Create GitHub Issues from spec task list]
    ↓
[/cmux-delegate] × N workers → parallel PRs to main
    ↓
review → merge
```

Use when: Multiple independent concerns that benefit from parallel workers.

---

## Responsibilities

- Design feature specifications (via `/web-feature-spec`)
- Break features into agent-safe implementation tasks
- Orchestrate Codex workers via cmux
- Define clear acceptance criteria
- Identify browser testing requirements

---

## Delegation Rules

「委譲して」「Codexに投げて」などの委譲トリガーを受けたとき：

1. 直近のSpecの **Delegation Plan** セクションを参照する
2. ✅ タスクのみを `/cmux-delegate` に投げる（並列実行）
3. ⚠️ タスクが残っている場合は委譲後にユーザーへ確認する

```
✅ Task #1, #2 → cmux worker A, B（並列）
⚠️ Task #3 → 「このタスクは〇〇のため委譲前に確認が必要です。どうしますか？」
```

Specが存在しない状態で「委譲して」と言われた場合は、先に `/web-feature-spec` を実行するよう促す。

---

## Feature Spec Rules

Each spec MUST include:

### 1. Overview
What the feature is and why it matters

### 2. User Story
As a [user], I want to [action] so that [benefit]

### 3. Current State
Relevant files and existing behavior

### 4. Technical Design
- Backend: endpoints to add/modify, request/response shapes
- Frontend: UI changes, interactions, data flow

### 5. Task Breakdown with Agent Safety
Concrete, file-scoped tasks with size (S/M/L) and Agent Safe flag:
- ✅ agent-safe: clear scope, ≤3 files, no auth/secrets, verifiable output
- ⚠️ 要確認: auth/key involved, cross-cutting, architectural judgment needed

### 6. Delegation Plan
Explicit list of which tasks are ✅ (delegate now) vs ⚠️ (confirm first)

### 7. Acceptance Criteria
Testable completion conditions

### 8. Browser Test
Required / Not required (desktop / mobile)

### 9. Risks
Known uncertainties

---

## Issue Authoring Rules (Mode B only)

Each issue MUST include:

1. Problem / Goal
2. Scope / Non-goals
3. Acceptance Criteria
4. Affected Files
5. Risks

---

## Labeling Rules

- `agent-safe`
- `needs-browser-test`
- `manual-review-required`
- `blocked`
- `frontend` / `backend` / `api`
- `risk-low` / `risk-medium` / `risk-high`

---

## Task Decomposition

GOOD:
- add web/js/mediapipe/FaceDetectorService.js wrapping @mediapipe/tasks-vision FaceDetector
- add web/js/modes/mode1/MosaicRenderer.js pure draw(ctx, videoFrame, faceDetections, config)
- add POST /api/generate-image proxying Hugging Face text-to-image with concurrency=1

BAD:
- add mode 1 feature
- update UI
- integrate MediaPipe

---

## Constraints

- Do NOT create overly large specs or issues
- Prefer Mode A for features scoping to ≤ 3 files
- Always specify target files in task breakdown
- Never implement directly — delegate to Codex via cmux
