---
name: cmux-delegate
description: >
  このスキルは、ユーザーが「Codexに投げて」「Codexに頼んで」「Codexで実装して」「Codexに任せて」
  「別Claudeに投げて」「別Claudeに頼んで」「別Claudeで実装して」「別Claudeに任せて」
  「cmuxで委譲」「/cmux-delegate」と依頼した場合に使用される。
  「Codexに#119を頼んで」のように GitHub Issue 番号でタスクを指定することもできる。
  複数 Issue を同時指定（例: codex #122 #123）すると並列実行する。
  cmux サーフェスの AI エージェント（主に Codex）に作業を委譲し、完了監視・結果報告まで行う。
version: 0.3.0
argument-hint: "[codex|claude] [タスク内容 or #Issue番号 ...]"
---

# cmux-delegate

cmux サーフェスで動作する AI エージェント（Codex, 別 Claude 等）に作業を委譲し、完了を監視して結果を報告する。
Claude がコーディネーター（計画・指示）、指定エージェントが作業担当という役割分担で並行開発を実現する。

**コーディネーターは Write/Edit を使わない。** 作業は全て委譲先エージェントに任せる。

---

## cmux の構造

cmux はウィンドウ > ワークスペース > ペイン > サーフェスの4層構造。
各サーフェスは独立したターミナルセッションで、環境変数 `CMUX_SURFACE_ID` で識別される。

---

## 呼び出しパターン

| パターン | 例 |
|:---|:---|
| エージェント + 単一タスク | `/cmux-delegate codex "チャット機能を実装して"` |
| エージェント + 単一 Issue | `/cmux-delegate codex #122` |
| エージェント + 複数 Issue（並列） | `/cmux-delegate codex #122 #123 #124` |
| エージェントのみ | `/cmux-delegate codex` → 直前の会話からタスク自動抽出 |
| 引数なし | `/cmux-delegate` → AskUserQuestion でエージェントとタスクを確認 |

対応エージェント:

| エージェント | 起動コマンド | 備考 |
|:---|:---|:---|
| `codex` | `codex --no-alt-screen` | `--no-alt-screen` はサーフェス監視に必要 |
| `claude` | `claude --dangerously-skip-permissions` | |

---

## Step 1: 引数パース・タスク特定

1. 第1引数 → エージェント種別（`codex` / `claude`）。省略時は `codex` をデフォルトとする
2. 第2引数以降 → タスク内容。**`#N` 形式の Issue 番号が含まれる場合は GitHub Issue を取得してタスクを補完する**
3. **`#N` が複数含まれる場合は並列モード** — Issue ごとに独立したサーフェスを作成する
4. 不足分は AskUserQuestion で補完

### Issue 番号からタスクを取得する

```bash
gh issue view 119 --json title,body,labels
```

取得した Issue の title・body・labels を読み込み、エージェントへの指示に組み込む。

---

## Step 2: サーフェス作成（常に新規）

### 2a: 自分のサーフェス ID を記録

```bash
echo $CMUX_SURFACE_ID
```

空の場合は cmux 環境外なのでエラー報告して終了する。

### 2b: タスク数だけ新規サーフェスを作成する

**既存の Codex サーフェスは再利用しない。** タスクごとに必ず新規サーフェスを作成する。
これにより複数タスクが互いに干渉せず並列実行できる。

タスクが N 個ある場合、以下を N 回繰り返す：

```bash
# 現在のサーフェス一覧を取得（作成前）
cmux tree --all

# 新規サーフェスを現在のペインに追加
cmux new-surface --pane <current_pane_id>

# 作成後に再取得し、新しく増えたサーフェス ID を {target_N} として記録
cmux tree --all
```

`cmux tree --all` の出力を比較し、新たに追加された surface の ID を記録する。

### 2c: 各サーフェスでエージェントを起動する

```bash
cmux send --surface {target_N} 'codex --no-alt-screen'
cmux send-key --surface {target_N} enter
```

起動確認（5秒待ってから `cmux read-screen` で確認）：

```bash
sleep 5
cmux read-screen --surface {target_N} --lines 3
```

プロンプトや起動画面が表示されれば起動完了。更新プロンプトが出た場合は `enter` で承認する。

---

## Step 3: タスクファイル生成と送信

### 3a: タスクファイルの生成

各タスクにユニークなファイル名を使う（`CMUX_SURFACE_ID` + Issue番号 or タイムスタンプ）。

```bash
TASK_FILE="/tmp/cmux_task_${CMUX_SURFACE_ID}_<issue_or_timestamp>.md"

{
  cat CODEX.md
  echo ""
  echo "---"
  echo ""
  echo "## Your Task: Issue #<N>"
  echo ""
  gh issue view <N> --json title,body | jq -r '"# \(.title)\n\n\(.body)"'
} > "${TASK_FILE}"
```

### 3b: 送信

**ファイルパスのみ1行で送信する。**（cmux send は改行を含むテキストを直接送れないため、ファイル経由で渡す）

```bash
cmux send --surface {target_N} "Read ${TASK_FILE} and follow all instructions."
cmux send-key --surface {target_N} enter
```

複数タスクの場合、全サーフェスへの送信が完了してから監視フェーズに入る。

---

## Step 4: 完了監視

### 監視スクリプトの生成と実行

各サーフェスに対して監視スクリプトをファイルに書き出し、`run_in_background: true` で実行する。

**重要な前提知識：**
- Codex が LLM 推論中は `cmux read-screen` が `Surface is not a terminal` を返す → エラーとして無視してループ継続
- `›` はアイドル時の入力候補にも承認プロンプトにも出現するため、完了判定に使ってはならない
- `Worked for` が画面に出れば完了確定

**監視スクリプトのテンプレート（各サーフェスに1ファイル生成する）：**

```bash
MONITOR_SCRIPT="/tmp/monitor_${CMUX_SURFACE_ID}_{target_N}.sh"
cat > "$MONITOR_SCRIPT" << 'SCRIPT'
#!/bin/bash
SURFACE="$1"
MAX=90          # 最大90回 × 10秒 = 15分
count=0

while [ $count -lt $MAX ]; do
    output=$(cmux read-screen --surface "$SURFACE" --lines 10 2>&1)

    # Codex 推論中はサーフェスが読めない → スキップ
    if echo "$output" | grep -q "Surface is not a terminal"; then
        sleep 10; count=$((count+1)); continue
    fi

    # 承認プロンプト → 自動で enter を送って継続
    if echo "$output" | grep -q "confirm or esc"; then
        cmux send-key --surface "$SURFACE" enter
        sleep 3; continue
    fi

    # 完了判定
    if echo "$output" | grep -q "Worked for"; then
        echo "DONE: $SURFACE"
        exit 0
    fi

    sleep 10; count=$((count+1))
done

echo "TIMEOUT: $SURFACE"
exit 1
SCRIPT
chmod +x "$MONITOR_SCRIPT"
```

スクリプト生成後、`run_in_background: true` で起動する：

```bash
bash /tmp/monitor_${CMUX_SURFACE_ID}_{target_N}.sh {target_N}
```

並列タスクの場合はサーフェスの数だけスクリプトを生成し、全て同時に `run_in_background: true` で起動する。

### 通知受信時の処理

バックグラウンドタスクの完了通知が届いたら出力ファイルを確認する：

- `DONE: surface:X` → そのサーフェスは完了
- `TIMEOUT: surface:X` → タイムアウト。AskUserQuestion でユーザーに継続/中断を確認する

全サーフェスが `DONE` になったら Step 5 へ進む。

### 注意事項

- `until cmux read-screen | grep` パターンは **使用禁止**。`Surface is not a terminal` エラーをグレップが素通りし、承認プロンプトで誤検知する
- サーフェスを閉じる前に、そのサーフェスを監視しているバックグラウンドタスクが完了していることを確認する

---

## Step 5: 結果報告

全タスク完了後：

1. PR 一覧を取得してタスクごとの結果サマリーをユーザーに伝える
2. 次のアクション（レビュー、マージ等）はユーザーが判断する — 勝手に実行しない

```bash
gh pr list --limit 20
git branch -a | grep feat
```

### サーフェスの後片付け

結果報告が完了したら、このタスクで作成したサーフェスを全て閉じる：

```bash
cmux close-surface --surface {target_1}
cmux close-surface --surface {target_2}
# タスク数分繰り返す
```

---

## エラーハンドリング

| エラー | 対応 |
|:---|:---|
| cmux 環境外（`CMUX_SURFACE_ID` が空） | エラー報告して終了 |
| サーフェス作成失敗 | エラー報告して終了 |
| エージェント起動失敗 | エラー報告して終了 |
| `Surface is not a terminal` | Codex 推論中の正常状態。監視スクリプト内でスキップして継続 |
| `confirm or esc` プロンプト | 監視スクリプト内で自動的に `enter` を送信して継続 |
| タイムアウト（15分超過） | ユーザーに状況報告 + 継続/中断を確認 |
| send 失敗 | エラー報告して終了 |
| サーフェスクローズ後に監視継続 | サーフェスを閉じる前に監視スクリプトの完了を確認すること |
