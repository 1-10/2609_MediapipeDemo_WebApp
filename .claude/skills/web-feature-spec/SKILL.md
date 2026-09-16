---
name: web-feature-spec
description: Webアプリの新機能仕様書（Feature Spec）を作成するスキル。「新機能を追加したい」「〜を実装したい」「仕様書を作って」「feature specを作って」「〜の設計をして」「〜をWebアプリに追加したい」など、新機能追加・新エンドポイント追加・新UI要素の追加に関するリクエストが来た場合に積極的に使用する。既存バグ修正やリファクタリングではなく、新機能設計に特化。/web-feature-spec と明示的に呼ばれた場合も使用する。
---

# Web Feature Spec

新機能をWebアプリに追加する際の設計仕様書を作成するスキルです。

## 目的

- 曖昧な機能要求を構造化された実装仕様に変換する
- Codexワーカーが迷わず実装できるタスク単位に分解する
- `/cmux-delegate` で委譲するための十分なコンテキストを提供する

---

## 実行手順

### Step 1: 要求の把握

ユーザーの機能要求から以下を特定する：

1. **何を作るか** — 新しいUI要素 / APIエンドポイント / 処理ロジック
2. **誰が使うか** — エンドユーザー操作 / 自動処理
3. **現状との差分** — 既存のどのファイル/機能に関連するか

不明点があれば、**1〜2個に絞って**質問する。質問攻めにしない。

現在のプロジェクト構造を確認する（必要に応じて）：
- `server/routes.js` — 既存エンドポイント（`/api/*`）
- `web/index.html`, `web/js/**` — 既存UI（renderer）
- `specs/ai_artist_signage_design/AI_Artist_Signage_Architecture_v0.3.md` — モジュール契約（新規モジュールはここに追記する）

### Step 2: 仕様書の作成

`specs/YYYY-MM-DD-<feature-name>.md` に保存する。

例：`specs/2026-05-13-fortune-animation.md`

以下のテンプレートを使用する：

---

```markdown
# Feature Spec: <機能名>

**作成日**: YYYY-MM-DD  
**ステータス**: Draft

---

## Overview

<1〜2文で機能の概要と目的>

## User Story

> As a [ユーザー種別],  
> I want to [操作・機能],  
> so that [得られる価値].

## Current State

現状の関連ファイルと動作：
- `server/routes.js`: <現状の関連エンドポイント>
- `web/index.html`: <現状の関連UI>

## Technical Design

### Backend (server/)
- 追加/変更するエンドポイント: `METHOD /api/xxx`
- リクエスト: `{ field: type, ... }`
- レスポンス: `{ field: type, ... }`
- 主な処理ロジック

### Frontend (web/)
- 追加/変更するUI要素
- ユーザーインタラクション（ボタン押下 → 何が起きる）
- APIコール方法（fetch先、成功・エラーハンドリング）

### Data Flow
```
User Action → [Frontend fetch] → POST /api/xxx → [server/routes.js] → JSON Response → [UI更新]
```

## Task Breakdown

| # | タスク | サイズ | 対象ファイル | Agent Safe? |
|---|--------|--------|-------------|-------------|
| 1 | <具体的なタスク名> | S/M/L | `server/...` | ✅ / ⚠️ |
| 2 | <具体的なタスク名> | S/M/L | `web/js/...` | ✅ / ⚠️ |

**サイズ目安**: S = 30分以内 / M = 2時間以内 / L = 半日以内

**Agent Safe 判定基準**:
- ✅ agent-safe: 対象ファイルが明確、スコープが1〜3ファイル以内、セキュリティ非関与、Acceptance Criteriaをcurl/ブラウザで検証可能
- ⚠️ 要確認: 認証/APIキー関与、複数システムにまたがる変更、アーキテクチャ判断を含む、仕様に曖昧さが残る

## Delegation Plan

「委譲して」と言われたとき、✅タスクのみを対象にする。⚠️タスクは委譲前にユーザーと確認する。

**✅ 即委譲可能:**
- Task #X: <タスク名>
- Task #Y: <タスク名>

**⚠️ 委譲前に要確認:**
- Task #Z: <タスク名> — 理由: <なぜ確認が必要か>

## Acceptance Criteria

- [ ] <ブラウザで確認できる条件1>
- [ ] <ブラウザで確認できる条件2>
- [ ] <APIレスポンスで確認できる条件>

## Browser Test

- [ ] Desktop Chrome: 必要 / 不要
- [ ] Mobile Safari: 必要 / 不要

## Risks

- <リスク1>: <影響と対策>
```

---

### Step 3: Specサマリーの提示

仕様書保存後、会話内でサマリーを提示する：

```
✅ Spec作成完了: specs/YYYY-MM-DD-<name>.md

即委譲可能なタスク:
  #1 <タスク名> (M, server/routes.js)
  #2 <タスク名> (S, web/js/...)

委譲前に確認が必要なタスク:
  #3 <タスク名> ⚠️ — <理由>

「委譲して」と言うと #1, #2 を並列でCodexに投げます。
```

---

## 仕様書作成のガイドライン

- タスクは**1ファイル単位**が理想。最大でも3ファイル以内に収める
- バックエンドとフロントエンドのタスクは分割して並列実行を可能にする
- 「〜を実装する」ではなく「`/api/fortune` エンドポイントを追加してJSONを返す」のように具体的に書く
- Acceptance Criteriaはブラウザ or curlで確認できる形にする
- 曖昧なまま仕様書を書かない。ユーザーに確認してから書く
- ⚠️タスクは理由を必ず1行で書く（何が不確かなのかを明示する）
- 仕様書はプロジェクトの永続ドキュメントとして機能する（後から参照できる品質で書く）
