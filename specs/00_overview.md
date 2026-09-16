# MediaPipe Demo App — Overview

## 1. Purpose

Webカメラ映像を入力とし、MediaPipeを中心としたリアルタイム画像解析・変換を用いて、以下2つの技術コンセプトを体験的に比較・理解できるデモアプリケーションを実装する。

- **Mode 1: 映像抽象度比較**
  - 同一のカメラ映像から、保持する視覚情報量の異なる3段階の映像を同時表示する。
- **Mode 2: セマンティック通信**
  - カメラ映像そのものを画像生成側へ渡さず、映像から抽出した「意味情報」だけを使って別画像として再構成する。

本アプリは展示・デモ用途を前提とし、研究精度の追求よりも以下を優先する。

1. 技術コンセプトが一目で理解できること
2. 安定して動作すること
3. 処理フローが説明可能であること
4. 各処理モジュールを後から差し替えられること

---

## 2. Runtime / Platform

初期実装は **Webアプリ** とする。

### Input
- Webカメラ
- 1系統のみ
- 取得映像を各モード内の複数処理へ分岐する

### Core Technologies
- MediaPipe
  - Face Detector
  - Object Detector
  - Image Segmenter / Person Segmentation
  - 必要に応じて Pose / Hand を追加可能
- HTML Canvas / WebGL 等による描画
- Hugging Face Inference Providers 経由の Text-to-Image API

---

## 3. Application Structure

```text
Web Camera
   ↓
Camera Input Manager
   ↓
Frame Hub
   ├──────────────────────────────┐
   │                              │
   ↓                              ↓
Mode 1 Pipeline              Mode 2 Pipeline
   │                              │
   ├─ Face Detector               ├─ Object Detector
   ├─ Person Segmentation         ├─ Optional Segmenter
   │                              ├─ Optional Pose / Hand
   ↓                              ↓
3-pane Renderer              Semantic Packet Builder
                                  ↓
                             Prompt Builder
                                  ↓
                             ImageGenerator Adapter
                                  ↓
                         Hugging Face Provider
                                  ↓
                         Semantic Reconstruction
```

---

## 4. Mode Switching

UI上で以下の2モードを切り替え可能とする。

```text
[ Mode 1: 映像抽象度比較 ]
[ Mode 2: セマンティック通信 ]
```

非表示モード側の高負荷処理は原則停止する。

特に Mode 2 の画像生成API呼び出しは、Mode 2 がアクティブな場合のみ実行する。

---

## 5. Design Principles

### 5.1 Single Camera / Shared Frame

同じカメラフレームに対して複数処理を実行する。

処理ごとに個別に `getUserMedia()` を呼ばない。

### 5.2 Shared Inference

同じ推論結果を複数表示で使用できる場合は再利用する。

例:

```text
Face Detector
   ├─ Mode 1 中央：顔モザイク
   └─ Mode 1 右：顔検出UI
```

Face Detectorを2回実行しない。

### 5.3 Frame Identity

各フレームは少なくとも以下を持つ。

```ts
type FrameContext = {
  frameId: number;
  timestampMs: number;
};
```

Mode 1 の3画面は可能な限り同一 `frameId` を基準に描画する。

### 5.4 Model / Provider Independence

画像生成モデルをUIやMode 2本体へ直接ハードコードしない。

```ts
interface ImageGenerator {
  generate(request: GenerateRequest): Promise<GeneratedImage>;
}
```

実モデル・APIはAdapter配下へ隔離する。

---

## 6. Security

Hugging Face API Tokenはブラウザへ埋め込まない。

```text
Browser
   ↓ semantic prompt
Application Backend
   ↓ HF Token
Hugging Face Inference Providers
```

`.env` 等でサーバー側のみ保持する。

---

## 7. Performance Philosophy

### Mode 1
リアルタイム性を優先。

目標:
- Camera render: 約30fps
- MediaPipe inference: 端末性能に応じて間引き可
- UI描画は推論完了待ちでカメラ表示全体を止めない

### Mode 2
完全な動画同期は要求しない。

目安:
- Camera: 約30fps
- Semantic extraction: 2–5fps
- Semantic state update: 1–2fps
- Image generation: API完了駆動
- Reconstruction refresh: 生成完了ごと

---

## 8. Demo Terminology

Mode 1右ペインの展示名称は「顔認証映像」としてもよいが、技術仕様上は **Face Detection** であり、個人識別・本人認証は行わない。

仕様書・ソースコードでは以下を区別する。

- Face Detection: 顔がある位置を検出
- Face Recognition / Authentication: 誰であるかを特定・認証

本デモで実装するのは前者のみ。

---

## 9. Out of Scope

初期バージョンでは以下を対象外とする。

- 個人識別
- 顔特徴量DB
- 録画
- 永続的な映像保存
- WebRTCによる実ネットワーク伝送
- 実映像コーデックの圧縮率比較
- セマンティック通信の標準規格実装
- 生成画像と元映像の画素レベル一致

---

## 10. File Structure

```text
specs/
├── 00_overview.md
├── 10_mode1_abstraction_comparison.md
├── 11_mode2_semantic_communication.md
└── 20_architecture_and_acceptance.md
```
