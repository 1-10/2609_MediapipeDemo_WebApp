# Architecture and Acceptance

## 1. Module Architecture

```text
src/
├── camera/
│   ├── CameraInputManager
│   └── FrameHub
├── mediapipe/
│   ├── FaceDetectorService
│   ├── ObjectDetectorService
│   └── SegmentationService
├── modes/
│   ├── mode1/
│   │   ├── Mode1Controller
│   │   ├── SilhouetteRenderer
│   │   ├── MosaicRenderer
│   │   └── FaceOverlayRenderer
│   └── mode2/
│       ├── Mode2Controller
│       ├── SemanticExtractor
│       ├── SemanticPacketBuilder
│       ├── PromptBuilder
│       └── ReconstructionRenderer
├── generation/
│   ├── ImageGenerator
│   └── HuggingFaceImageGenerator
├── config/
│   └── AppConfig
└── debug/
    └── DebugOverlay
```

名称は実装言語・frameworkに合わせて変更してよいが、責務分離は維持する。

---

## 2. State Separation

### Camera State

```ts
type CameraState =
  | "idle"
  | "requesting"
  | "ready"
  | "denied"
  | "error";
```

### Mode 1 State

```ts
type Mode1State = {
  frameId: number;
  faceDetections: FaceDetection[];
  segmentationMask?: SegmentationMask;
};
```

### Mode 2 State

```ts
type Mode2State = {
  semanticPacket?: SemanticPacket;
  generationStatus:
    | "idle"
    | "generating"
    | "success"
    | "error";
  latestGeneratedImageUrl?: string;
};
```

---

## 3. Configuration

最低限、以下はコード内定数に埋め込まずconfig化する。

```text
camera width / height
face detection threshold
segmentation threshold
mosaic block size
mosaic bbox expansion
object detection threshold
semantic extraction interval
image generation model
generated image width / height
generation style prompt
debug enabled
```

---

## 4. Concurrency Rules

### Mode 1

MediaPipe inferenceが重い場合でも、カメラ自体の描画を停止させない。

推論中に次フレームが来た場合は、処理queueを無制限に増やさない。

推奨:

```text
if inferenceBusy:
    skip current inference frame
```

### Mode 2

生成requestは同時1件を基本とする。

```text
MAX_GENERATION_CONCURRENCY = 1
```

生成中にsemantic stateが更新された場合:
- queueへ全stateを積まない
- 最新stateのみ保持
- 現在の生成完了後に最新stateで次を生成

---

## 5. Resource Lifecycle

モード切替時:

### Mode 1 → Mode 2
- Mode 1専用renderer停止
- 不要なFace Detection / segmentation loop停止
- Mode 2 semantic extraction開始

### Mode 2 → Mode 1
- 新規image generation停止
- 可能なら進行中requestをabort
- Mode 2 inference loop停止
- Mode 1 inference開始

Camera stream自体は再取得せず共有する。

---

## 6. Error UX

展示デモのため、開発者向けstack traceを通常画面に出さない。

表示例:

```text
Camera unavailable
Please allow camera access.
```

```text
Semantic reconstruction temporarily unavailable.
Live analysis is still running.
```

---

## 7. Benchmark Logging

debug時に以下を取得可能にする。

### Common
- camera FPS
- render FPS

### MediaPipe
- face inference ms
- object detection ms
- segmentation ms

### Mode 2
- semantic packet bytes
- prompt length
- image generation latency ms
- generator errors
- generated image count

---

## 8. Acceptance — Whole Application

### Startup
- Webカメラ許可を要求できる
- 許可後に映像が表示される
- 許可拒否時にクラッシュしない

### Mode Switching
- Mode 1 / Mode 2をUIから切替可能
- 非アクティブモードの高負荷処理が停止する
- Camera streamは切替のたびに再初期化しない

### Mode 1
- 3ペインが同じ入力ソースから描画される
- silhouette / mosaic / detection overlayが成立する
- Face Detectorは中央と右で共有
- 顕著な同期ズレがない

### Mode 2
- original live videoが表示される
- semantic words / packetが表示される
- 元画像をgeneratorへ送らない
- Hugging Face経由でText-to-Image生成
- 生成完了ごとに右ペイン更新
- concurrency 1
- model configurable

### Security
- Hugging Face TokenがブラウザJSへ露出しない
- tokenをconsoleへ出力しない

### Stability
- 5分以上連続動作でメモリが継続増加しない
- canvas / generated image URLを適切に解放する
- generation失敗後も再試行可能
- Mode 1はネットワーク断でも動作可能

---

## 9. Initial Implementation Priority

### Phase 1
1. Camera Input Manager
2. Mode switch
3. Mode 1 Face Detector
4. Mode 1 face mosaic
5. Mode 1 person silhouette

### Phase 2
6. Mode 2 Object Detector
7. SemanticPacket
8. Semantic information UI
9. Prompt Builder

### Phase 3
10. Backend proxy
11. Hugging Face ImageGenerator
12. Reconstruction pane
13. generation queue / error handling

### Phase 4
14. Debug overlay
15. performance tuning
16. exhibition visual polish

---

## 10. Non-negotiable Implementation Rules

1. Webカメラ入力は1系統
2. Mode 1中央・右でFace Detector推論を共有
3. Mode 2ではカメラ画像を画像生成APIへ送信しない
4. HF Tokenをブラウザへ置かない
5. Mode 2生成requestを無制限queueしない
6. image generator実装をAdapter化する
7. モデル名・主要thresholdをconfig化する
8. 展示UIとdebug UIを分離する
