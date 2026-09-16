---
name: tmux-delegate
description: >
  このスキルは、ユーザーが「Codexに投げて」「Codexに頼んで」「Codexで実装して」「Codexに任せて」
  「別Claudeに投げて」「別Claudeに頼んで」「別Claudeで実装して」「別Claudeに任せて」
  「tmuxで委譲」「委譲して」「/tmux-delegate」と依頼した場合に使用される。
  tmux ペインの AI エージェント（Codex, Claude 等）に作業を委譲し、完了監視・結果報告まで行う。
version: 0.3.1
argument-hint: "[codex|claude] [タスク内容]"
allowed-tools: Bash(tmux *), Bash(MSYS_NO_PATHCONV=1 tmux *), Bash(git diff *), Bash(git status *), Bash(sleep *), Bash(printf *), Read, Glob, Grep, AskUserQuestion
---

# tmux-delegate

tmux ペインで動作する AI エージェント（Codex, 別 Claude 等）に作業を委譲し、完了を監視して結果を報告する。
Claude がコーディネーター（計画・指示）、指定エージェントが作業担当という役割分担で並行開発を実現する。

**コーディネーターは Write/Edit を使わない。** 作業は全て委譲先エージェントに任せる。

---

## ペイン識別の原則

**ペインの参照には常に `pane_id`（`%N` 形式）を使う。`pane_index` は使わない。**

- `pane_index`（`0`, `1`, `2`）はペインの追加・削除・並び替えで変化する位置番号
- `pane_id`（`%0`, `%3`, `%17`）は tmux サーバー起動中に絶対変化しない一意ID
- `-t %5` のようにセッション・ウィンドウの指定なしでグローバルに参照可能

---

## 呼び出しパターン

| パターン | 例 |
|:---|:---|
| エージェント + タスク | `/tmux-delegate codex "チャット機能を実装して"` |
| エージェントのみ | `/tmux-delegate codex` → 直前の会話からタスク自動抽出 |
| 引数なし | `/tmux-delegate` → AskUserQuestion でエージェントとタスクを確認 |

対応エージェント:

| エージェント | 起動コマンド | 備考 |
|:---|:---|:---|
| `codex` | `codex --no-alt-screen` | `--no-alt-screen` は tmux での capture-pane に必要 |
| `claude` | `claude --dangerously-skip-permissions` | |

---

## Step 1: 引数パース・タスク特定

1. 第1引数 → エージェント種別（`codex` / `claude`）
2. 第2引数以降 → タスク内容
3. 不足分は AskUserQuestion で補完

---

## Step 2: tmux ペイン発見 or 作成

### 2a: 自分の pane_id を記録

```bash
tmux display-message -p '#{pane_id}'
```

結果（例: `%0`）を `{my_pane_id}` として記録する。

### 2b: 既存ペインの確認

```bash
tmux list-panes -F '#{pane_id} #{pane_current_command}'
```

自分（`{my_pane_id}`）以外で対象エージェントが起動済みのペインがあれば、その `pane_id` を `{target}` として記録して Step 3 へ進む。

### 2c: 新規ペイン作成

既存ペインがない場合、2段階で作成する:

```bash
tmux split-window -h -d
```

`-d` で新規ペインにフォーカスを移さない（元ペインに留まる）。

次に `list-panes` で新しいペインの `pane_id` を特定する:

```bash
tmux list-panes -F '#{pane_id} #{pane_current_command}'
```

Step 2b の結果と比較し、新たに増えた `pane_id` が `{target}`。

エージェント起動コマンドを送信:

```bash
MSYS_NO_PATHCONV=1 tmux send-keys -t {target} '{起動コマンド}' Enter
```

起動完了を確認するため、5秒待ってから capture-pane で入力待ち状態を確認する:

```bash
sleep 5
tmux capture-pane -t {target} -p -S -20
```

プロンプトが表示されていない場合はさらに数秒待って再確認する（最大3回）。

---

## Step 3: タスク送信

### 3a: 指示の組み立て

プロジェクトのコンテキスト（CLAUDE.md のルール、関連ファイル等）を踏まえた具体的な指示を組み立てる。
委譲先エージェントはプロジェクトルールを知らない前提で、必要な情報を指示に含める。

### 3b: 送信

**常に1行テキストとして `MSYS_NO_PATHCONV=1 tmux send-keys -l` で送信する。**

```bash
MSYS_NO_PATHCONV=1 tmux send-keys -t {target} -l '{指示テキスト}'
tmux send-keys -t {target} Enter
```

- `MSYS_NO_PATHCONV=1`: MSYS2（Git Bash）のパス変換を抑制する。これがないと `/exit` 等の `/` 始まりテキストが `C:/Program Files/Git/exit` に化ける
- `-l` (literal): シェル展開を防ぐ
- `Enter` は別呼び出しで送信する

#### 指示テキストの制約

- **改行を含めない（1行に整形する）。** 改行は `send-keys` 上で Enter として解釈され、途中送信になる
- 内容が多い場合は、プランファイル等に書き出してそのパスを指示に含める（エージェントが自律的にファイルを読む）

> **Note（psmux 互換性）**: `paste-buffer` は psmux（Windows 版 tmux）で TUI アプリ（Codex, Claude）にテキストを渡せない。`-p` (bracketed paste) / `-r` フラグの有無に関わらず動作しない。そのため `send-keys -l` に統一している。

---

## Step 4: 完了監視

30秒間隔で出力をキャプチャし、エージェントの完了を検知する。

```bash
sleep 30
tmux capture-pane -t {target} -p -S -200
```

### 完了判定

エージェントが入力待ち状態に戻ったことをもって完了と判断する:
- **codex**: 以下のいずれかで完了と判断する:
  - 末尾に `❯` プロンプトが表示されている
  - `Working` / `Waiting` のインジケーターが消え、最終出力ブロックの後にプロンプト行（`›`）が表示されている
  - 出力に完了サマリー（変更ファイル一覧、結果報告等）が含まれ、その後に新たな `Working` が表示されていない
- **claude**: 末尾に `>` プロンプトが表示されている状態

### タイムアウト

最大15分（30回のポーリング）。超過した場合は現在の出力をキャプチャして AskUserQuestion でユーザーに状況を報告し、継続 or 中断を確認する。大規模な実装タスクでは10分以上かかることがあるため、作業が進んでいる限り（出力が変化している限り）はタイムアウトせず待ち続ける。

### 完了時

出力をキャプチャする:

```bash
tmux capture-pane -t {target} -p -S -500
```

Bash の出力結果を直接読み取る（tmpファイルへの保存は不要）。

---

## Step 5: 結果報告

1. キャプチャした出力を読み、エージェントの出力をサマリーとして報告する
2. ファイル変更がある場合は `git diff --stat` で変更一覧を表示する
3. 次のアクション（コンパイル確認、テスト、コミット等）はユーザーが判断する — 勝手に実行しない

---

## エラーハンドリング

| エラー | 対応 |
|:---|:---|
| tmux セッション外で実行 | エラー報告して終了 |
| エージェント起動失敗 | エラー報告して終了 |
| タイムアウト（15分超過） | ユーザーに状況報告 + 継続/中断を確認 |
| send-keys 失敗 | エラー報告して終了 |
