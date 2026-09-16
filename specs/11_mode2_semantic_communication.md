# Mode 2 — セマンティック通信デモ

## 1. Goal

Webカメラ映像そのものを画像生成モデルへ渡さず、映像から抽出した **意味情報のみ** を使って別画像として再構成する。

デモの主題:

> 画素を送るのではなく、意味を送る。

---

## 2. UI Layout

基本は2ペイン。

```text
┌─────────────────────────┬─────────────────────────┐
│ LEFT                    │ RIGHT                   │
│ Original Live Video     │ Semantic Reconstruction │
│                         │ Generated Image         │
│                         │                         │
└─────────────────────────┴─────────────────────────┘
```

加えて、画面中央または下部に「送信されている意味情報」を可視化する。

例:

```text
person
dark shirt
raising right hand
display
indoor room
```

または短いJSON風UI。

これにより「元映像そのものは送っていない」ことを来場者へ明示する。

---

## 3. Core Rule

画像生成モデルへ **元カメラ画像を渡してはならない**。

禁止:

```text
Camera Image
   ↓
img2img / image-conditioned generation
```

採用:

```text
Camera Image
   ↓
MediaPipe / CV
   ↓
Semantic Packet
   ↓
Text Prompt
   ↓
Text-to-Image
```

右ペインは視覚的に元画像へ近づけることより、意味内容を保った再構成を優先する。

---

## 4. Semantic Extraction

### Primary: Object Detector

画角内の主要物体をラベル化する。

例:

```text
person
chair
bottle
laptop
cat
table
```

Mode 2ではObject Detectorを意味抽出の主役とする。

### Optional: Image Segmenter

Image Segmenter単独では自然な物体記述の生成に不足するため、補助情報取得に使用する。

想定用途:

- foreground / background
- 人物領域の占有率
- 大まかな構図
- 主要領域の位置
- 背景分離

### Optional: Pose / Hand

人物が重要な場合、ジェスチャ情報を追加する。

例:

```text
raising right hand
standing
arms crossed
```

初期バージョンでは必須ではない。

---

## 5. Attributes

Object Detectorから得たラベルに、軽量な属性情報を付加してよい。

想定属性:

- position
  - left
  - center
  - right
- size
  - small
  - medium
  - large
- count
- dominant color
- rough pose / gesture

例:

```text
person, center, large, dark top, raising right hand
chair, left, medium
display, background
```

---

## 6. Semantic Packet

アプリ内部では構造化された意味情報を保持する。

初期データモデル:

```ts
type SemanticPacket = {
  timestampMs: number;
  scene?: {
    environment?: string;
    layout?: string;
  };
  objects: Array<{
    label: string;
    count?: number;
    position?: "left" | "center" | "right";
    size?: "small" | "medium" | "large";
    attributes?: string[];
  }>;
};
```

Example:

```json
{
  "timestampMs": 123456,
  "scene": {
    "environment": "indoor",
    "layout": "single subject centered"
  },
  "objects": [
    {
      "label": "person",
      "count": 1,
      "position": "center",
      "size": "large",
      "attributes": [
        "dark top",
        "raising right hand"
      ]
    },
    {
      "label": "display",
      "count": 1,
      "position": "center"
    }
  ]
}
```

---

## 7. Prompt Builder

SemanticPacketをText-to-Image向けpromptへ変換する。

初期実装ではLLMを追加せず、テンプレート生成を推奨する。

理由:

- レイテンシ増加を避ける
- API依存を減らす
- 意味パケット→生成promptの対応を説明しやすい
- 動作を決定論的にしやすい

Example:

Input:

```text
person, center, large
dark shirt
raising right hand
display, background
indoor
```

Output:

```text
A simple illustration of one person standing in the center
of an indoor room, wearing a dark shirt and raising the right
hand. A display is visible in the background.
```

---

## 8. Image Generation

### Provider

Hugging Face Inference Providersを使用する。

### Initial Candidate

初期候補:

```text
black-forest-labs/FLUX.1-schnell
```

ただしモデルはconfigから変更可能にする。

```ts
type ImageGenerationConfig = {
  provider: "huggingface";
  model: string;
  width: number;
  height: number;
  stylePreset?: string;
};
```

### Adapter

```ts
interface ImageGenerator {
  generate(request: GenerateRequest): Promise<GeneratedImage>;
}
```

Hugging Face固有実装は以下へ隔離する。

```text
ImageGenerator
   └─ HuggingFaceImageGenerator
```

将来別モデル・別Providerへ変更できること。

---

## 9. API Security

Hugging Face Tokenをフロントエンドへ埋め込まない。

```text
Browser
   ↓
Backend endpoint
   ↓
Hugging Face Inference Providers
```

BackendのみがTokenを保持する。

---

## 10. Update Strategy

画像生成APIを一定周期で無条件に連打しない。

**生成完了駆動** とする。

```text
Camera
  ↓
Semantic State continuously updates
  ↓
Generate request
  ↓
Generating...
  ↓
Generation complete
  ↓
Right pane update
  ↓
Use latest semantic state
  ↓
Next generate request
```

生成中に新しいsemantic stateが来ても、現在のrequestを大量に積まない。

原則:
- 生成queue長は最大1
- 次回生成時は最新stateのみ使用
- 古い中間stateは破棄してよい

---

## 11. Suggested Processing Rates

初期目安:

```text
Camera rendering       ~30fps
Object detection       2–5fps
Semantic update        1–2fps
Image generation       completion-driven
Right pane refresh     each successful generation
```

右側が0.2–1fps程度でもデモとして成立する設計とする。

---

## 12. Reconstruction Style

右側を写実的に再現しすぎる必要はない。

推奨:
- simple illustration
- flat illustration
- clean anime-like rendering
- pictogram-like rendering

理由:
- 軽量モデルでも品質を安定させやすい
- semantic reconstructionであることが分かりやすい
- 元映像と完全一致しないこと自体がコンセプトに合う

スタイルは固定promptへ含める。

---

## 13. Semantic Information Display

来場者向けに以下を表示する。

例:

```text
TRANSMITTED SEMANTICS

• person
• center
• dark shirt
• raising right hand
• display
• indoor
```

必要に応じて実際のpacketサイズも表示可能とする。

例:

```text
Semantic Packet: 184 bytes
Update Rate: 1.0 Hz
Estimated Payload: 1.47 kbps
```

### Important

この値を表示する場合は実際のUTF-8 payload byte数から計算する。

```text
bitrate =
  packet_size_bytes
  × 8
  × packets_per_second
```

「10kbps相当」と説明する場合も、可能ならこの実測値を併記する。

---

## 14. Failure Handling

### Object Detector Failure
直前のsemantic stateを短時間保持してよい。

### Generator Timeout / Error
右ペインの直前生成画像を維持し、エラー表示を小さく出す。

### HF Rate Limit / Billing Error
生成を停止し、左映像・semantic extractionは継続する。

### Network Offline
Mode 2右側のみ利用不可とし、アプリ全体を停止させない。

---

## 15. Acceptance Criteria

- 左ペインにリアルタイムWebカメラ映像が出る
- Object Detectorで主要オブジェクトが抽出される
- 抽出した意味情報がUI上に可視化される
- 元カメラ画像を画像生成APIへ送らない
- SemanticPacketからpromptが生成される
- Hugging Face経由で画像生成できる
- 右ペインが生成完了ごとに更新される
- 生成中にAPI requestが無制限にqueueされない
- モデル名をconfigで変更可能
- HF Tokenがフロントエンドbundleに含まれない
