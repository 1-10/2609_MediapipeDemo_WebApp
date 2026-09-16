# Mode 1 — 映像抽象度比較

## 1. Goal

同一のWebカメラ映像を3分岐し、保持される視覚情報量・プライバシー性の違いをリアルタイムに比較できるデモとする。

画面は3分割。

```text
┌─────────────────┬─────────────────┬─────────────────┐
│ ① 侵入者検知    │ ② プライバシー │ ③ 顔認証映像    │
│                 │    配慮         │                 │
│ Silhouette      │ Face Mosaic     │ Face Detection  │
└─────────────────┴─────────────────┴─────────────────┘
```

表示順は左→中央→右で固定する。

---

## 2. Shared Input

すべて同一Webカメラを入力とする。

```text
Camera Frame
   ├─ Person Segmentation
   └─ Face Detector
```

推論結果を使って3種類のRendererへ描画する。

---

## 3. Pane 1 — 侵入者検知

### Purpose

人物の存在・位置・大まかな姿勢だけを残し、個人を特定できる視覚情報を大幅に削減する。

### Processing

```text
RGB Frame
  ↓
Person Segmentation
  ↓
Person Mask
  ↓
Threshold / Cleanup
  ↓
Silhouette Renderer
```

### Rendering

初期デフォルト:

- 背景: 黒
- 人物: 単色
- 元映像の色・テクスチャ・顔情報は表示しない

展示デザインに合わせて色変更可能とする。

### Mask Treatment

モデルのsoft maskをそのまま半透明表示するのではなく、基本はthreshold処理して明瞭なシルエットにする。

例:

```ts
binaryMask = personProbability >= SEGMENTATION_THRESHOLD;
```

`SEGMENTATION_THRESHOLD` はconfig化する。

### Preserved Information

- 人数の概略
- 人物位置
- 人物輪郭
- 動き
- 大まかなポーズ

### Discarded Information

- 顔
- 肌
- 髪型
- 衣服の模様
- 背景テクスチャ
- 個人識別につながる細部

---

## 4. Pane 2 — プライバシー配慮

### Purpose

通常映像の状況理解を保ちつつ、顔領域のみをモザイク化する。

### Processing

```text
RGB Frame
   ↓
Face Detector
   ↓
Face Bounding Boxes
   ↓
Bounding Box Expansion
   ↓
Pixelation / Mosaic
   ↓
Composite Renderer
```

### Bounding Box Expansion

顔検出矩形をそのまま使用すると輪郭や髪際が残りやすいため、一定割合拡張する。

初期値の目安:

```text
horizontal: 10–20%
vertical:   10–20%
```

正確な値はconfigから調整可能とする。

### Mosaic

標準方式:

1. 対象領域を低解像度化
2. nearest-neighborで元サイズへ拡大
3. 元フレームへ合成

モザイクブロックサイズもconfig化する。

### Multiple Faces

検出された全顔に対して適用する。

---

## 5. Pane 3 — 顔認証映像（展示名称）

### Technical Name

Face Detection View

個人識別は実施しない。

### Processing

```text
RGB Frame
   ↓
Face Detector
   ↓
Bounding Box + Confidence
   ↓
Overlay Renderer
```

### Overlay

各顔に対して以下を表示する。

- ターゲット / Bounding Box
- `Face - nn%`

`nn%` はFace Detectorが返す detection confidence を百分率表示したもの。

例:

```text
Face - 96%
```

複数人の場合は各顔へ個別表示。

---

## 6. Shared Face Detector

中央と右ペインでFace Detectorの推論を共有する。

```text
Face Detector
   ├─ Mosaic Renderer
   └─ Face Detection Overlay
```

禁止:

```text
Face Detector #1 → Mosaic
Face Detector #2 → Detection UI
```

---

## 7. Frame Synchronization

3ペインは同一カメラフレームを基準として描画する。

最低限:

```ts
type Mode1FrameState = {
  frameId: number;
  timestampMs: number;
  sourceFrame: VideoFrameLike;
  faceDetections: FaceDetection[];
  personMask?: SegmentationMask;
};
```

人物が動いた際に3ペイン間で明らかな時間差が出ないようにする。

---

## 8. Processing Frequency

カメラ自体は可能なら30fps。

Face Detector / Segmentationは毎フレーム必須ではない。

例:

```text
Camera rendering      30fps
Face inference        10–30fps
Segmentation          10–30fps
```

端末性能に応じて推論フレームを間引く。

前回推論結果の短時間保持を許可する。

---

## 9. Labels / Bandwidth Representation

展示資料の以下表現:

- ① ～10kbps
- ② ～100kbps
- ③ 数10～100Mbps

は、初期実装では **実際に当該ビットレートへ映像圧縮する処理を意味しない**。

本デモでは「保持・送信する情報量の違い」を視覚的に説明するラベルとして扱う。

実際の映像圧縮率を比較する機能はOut of Scope。

---

## 10. Debug Mode

例:

```text
?debug=true
```

で以下を表示可能とする。

- inference FPS
- render FPS
- face confidence
- face bounding boxes
- segmentation threshold
- inference time
- frameId

展示モードでは非表示。

---

## 11. Acceptance Criteria

- 1台のWebカメラから3ペインが同時表示される
- 左は人物シルエットのみになる
- 中央は顔のみモザイク化される
- 右は検出顔にターゲットとconfidence表示が付く
- 複数人でも全顔へ処理される
- 中央と右でFace Detectorが共有されている
- 3ペインの動きに顕著な時間ズレがない
- カメラが切断・拒否された場合にUIが破綻しない
