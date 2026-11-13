# shiki365 のツールのデザイン（緑青）

置き場サイトと各ツールで共通に使う、見た目の原本と道具をまとめたフォルダです。`_` で始まるフォルダの中なので、GitHub Pages では公開されません。

- **新しいツールを作るとき**は、ここのひな形から始めます（[新しいツールを作るとき](#新しいツールを作るとき)）。
- **今あるツールの見た目を直すとき**は、ここの `tool.css` を直してから各ツールに入れ直します（[今あるツールに入れるとき](#今あるツールに入れるとき)）。
- Claude などに作業を頼むときは、「`_dev/design/README.md` を読んで、その決まりで」と伝えれば足ります。

## 決まったことと、今の状態（2026-11-13）

- デザインは **「緑青（ろくしょう）」**（案を比べたときの名前は F 案）に決めました。決めるまでの経緯と、選ばなかった案は `_dev/design-proposals/` にあります。
- ダークとライトの両方を持ち、ページ上部の「自動 / ダーク / ライト」で切り替えます（`theme.v1.js`）。
- **緑青は、置き場サイトと 8 つのツールで公開済みです**（2026-11-13 に 9 つの PR をマージ）。
- SNS のカード画像（各ツールの `ogp.png`）と、置き場サイトのツールの絵（`thumbs/*.webp`）も緑青に合わせて作り直しました（`ogp/make-ogp.js`。下の「カード画像を作り直すとき」）。

| 対象 | リポジトリ | PR | 今の状態 | 入れ方 |
| --- | --- | --- | --- | --- |
| 置き場サイト | shiki365.github.io | [#2](https://github.com/shiki365/shiki365.github.io/pull/2) | 公開済み（`hub.css`） | `apply.js . --hub` |
| チャットウィンドウメーカー | chat-window-maker | [#2](https://github.com/shiki365/chat-window-maker/pull/2) | 公開済み（v1.13） | `apply.js` |
| メッセージボックスメーカー | message-box-maker | [#1](https://github.com/shiki365/message-box-maker/pull/1) | 公開済み（v1.4） | `apply.js` |
| ステータスバーメーカー | status-bar-maker | [#1](https://github.com/shiki365/status-bar-maker/pull/1) | 公開済み（v1.8） | `apply.js`（ツールだけの部分あり） |
| 前景フレームメーカー | foreground-frame-maker | [#1](https://github.com/shiki365/foreground-frame-maker/pull/1) | 公開済み（v2.4） | `apply.js`（ツールだけの部分あり） |
| 場面転換素材メーカー | scene-transition-maker | [#1](https://github.com/shiki365/scene-transition-maker/pull/1) | 公開済み（v2.5） | `apply.js`（対象は `docs/`。ツールだけの部分あり） |
| シナリオテキストメーカー | scenario-text-maker | [#1](https://github.com/shiki365/scenario-text-maker/pull/1) | 公開済み（v1.5） | `apply.js`（ツールだけの部分あり） |
| 表紙入稿メーカー | cover-print-maker | [#1](https://github.com/shiki365/cover-print-maker/pull/1) | 公開済み（v1.1。切り替えボタンも新しく入った） | `apply.js --version v1.1` |
| 同人誌の印刷所さがし | doujin-printer-finder | [#1](https://github.com/shiki365/doujin-printer-finder/pull/1) | 公開済み（v1.1。切り替えボタンも新しく入った） | `apply.js --version v1.1` |

どの PR も、作業用のブランチは `claude/awesome-carson-brtset` でした。9 つともマージ済みです。

## デザインの決まり

### 考え方

- **夜の卓と、キャラクターシート**: ダークは墨色の地に紙色の文字、ライトは紙に墨の文字。同じ道具を、夜の卓の上と、昼の紙の上に置いたように見せます。
- **差し色は緑青 1 色**: 選んでいるもの、進むボタン、見出しの印にだけ使います。警告の橙（`--warn`）とは別の色なので、注意書きが見出しや差し色に紛れません。プレビューの中の色（成功の青、失敗の赤など）とも重なりません。
- **見出しは罫線の上に置く**: 設定のまとまり（`fieldset` と `legend`）は、キャラクターシートの区切りのように「◆ 見出し ———」の形です。使い方の見出しと、置き場サイトの見出しも同じ形です。
- **枠は、まとまりと操作できる部品にだけ**: 設定のパネル、プレビュー、その下の箱、入力欄やボタン。パネルの中は罫線と余白で区切り、箱の中に箱を作りません。
- **プレビューには飾りを足さない**: 縁取りや印は、作っているデザインの一部に見えてしまうためです。プレビューの中（ココフォリアを再現した画面など）と、プレビューの背景（色つき・市松・暗い・明るい）は、ダークでもライトでも同じにします。

### 色（`:root` の変数）

| 変数 | 役目 | ダーク | ライト |
| --- | --- | --- | --- |
| `--bg` | ページの地 | `#10141a` | `#f3f0e9` |
| `--panel` | パネルや箱の面 | `#171c24` | `#fcfbf7` |
| `--raised` | 一段上の面（タブの帯、保存の行、選んだ項目） | `#1e242e` | `#efece4` |
| `--line` / `--line-soft` | 罫線 / 薄い罫線 | `#2c3440` / `#222a35` | `#d6d1c5` / `#e7e3d9` |
| `--frame` | 箱と部品の縁（地に対して 3:1 以上） | `#6b7686` | `#8b8778` |
| `--fg` / `--muted` | 文字 / 補足の文字 | `#e9e6df` / `#9ba4ae` | `#1b1f24` / `#585e66` |
| `--accent` / `--link` | 差し色 / リンク | `#5ccfc0` / `#7fdccf` | `#0e6a5c` / `#0b5c50` |
| `--button` / `--button-fg` / `--button-hover` | 主ボタン | `#5ccfc0` / `#06211d` / `#7adbce` | `#0e6a5c` / `#ffffff` / `#0a5448` |
| `--field` | 入力欄の地 | `#0c0f14` | `#ffffff` |
| `--control` / `--control-hover` | ふつうのボタンの地 | `#232b36` / `#2d3744` | `#efece4` / `#e3dfd4` |
| `--pick` | 選んだ行の地 | `#17302f` | `#dcefe9` |
| `--warn` / `--error` | 警告 / エラー | `#ffb86b` / `#ff8f8f` | `#8a4b00` / `#b3261e` |
| `--danger-bg` / `--danger-line` | 危ないボタンに乗せたとき | `#4a2529` / `#a05560` | `#f7dcdc` / `#c47b7b` |

置き場サイト（`hub.css`）には、このほかに `--soft`（説明文）、`--label-line` / `--label-fg`（「ベータ版」の札）、`--thumb-bg` があります。

### 文字と形

- 文字はシステムフォントだけです（`"Yu Gothic UI", "Meiryo", system-ui, sans-serif`）。Web フォントは読み込みません。数値・コードは `--mono`（`Consolas, "BIZ UDGothic"`）。
- ツールの本文は 13px、ラベルは 12.5px、説明は 12px。置き場サイトの本文は 14px。
- 入力欄・プルダウン・ボタン・色の欄は、高さ 28px、縁 1px（`--frame`）、角 4px で揃えます。パネルや箱の角は 6px。
- プルダウンの矢印は自前で描いています（`appearance: none` と 2 つのグラデーション）。スライダーとチェックボックスはブラウザの部品のまま、`accent-color` で差し色だけ変えます。
- 設定の行は、ラベル 104px と中身の 2 列（`.row`）で、行の間は 8px。

### 必ず守ること

- **色は直書きせず、変数で書く。** 新しい色が要るときは変数を足し、ダークとライトの値を同時に決めます。直書きの色が 1 つ残ると、片方の明るさだけで読めなくなります。
  - 例外: プレビューの中と、その背景、透明な画像の下に敷く市松。これらはどちらの明るさでも同じ色にします。
- **ライトの値は 2 か所に同じものを書く。** `@media (prefers-color-scheme: light) { :root:not([data-theme=dark]) { … } }` と `:root[data-theme=light] { … }` です。
- **文字のコントラストは 4.5:1 以上**（ボタン・入力欄・値の表示も）。縁は 3:1 以上。
- **幅 375px で横にはみ出さない。** グリッドの列は `minmax(0, 1fr)`、タブの帯は `overflow-x: auto`。英語は文が長いので、固定の幅を増やさないこと。
- **キーボードで操作できること。** タブは矢印キー・Home・End で動き、`:focus-visible` で差し色の outline が出ます。
- **動きは控えめに。** 色の切り替えの `transition` は `prefers-reduced-motion: no-preference` の中だけにします。
- **スライダーを動かしている間は、周りの行を出し入れしない**（Chromium がドラッグを打ち切るため）。出し入れは `change` で行います。
- **iframe のプレビューには `color-scheme: normal` を付ける**（外すと Chromium が iframe を白く塗ります）。
- 素の HTML・CSS・JS で、ビルドなし。外部のライブラリは増やさない。
- コードのコメントと識別子は英語、README と PR は日本語。

## このフォルダのファイル

| ファイル | 中身 |
| --- | --- |
| `tool.css` | **ツール共通のスタイルの原本。** 各ツールの `index.html` の `<style>` の前半は、これと 1 文字も違わないようにします |
| `hub.css` | 置き場サイト（リポジトリ直下の `index.html`）のスタイルの原本 |
| `tool-only/<リポジトリ名>.css` | そのツールだけの部品のスタイル。`<style>` の後半（`---- This tool only` の段落）になります |
| `apply.js` | ツールの `<style>` を `tool.css` ＋ ツールだけの部分に入れ替える。切り替えボタンがまだ無いツールには、それも入れる |
| `new-tool.js` | 新しいツールのフォルダを、ひな形から作る |
| `template/` | 新しいツールのひな形（ページの骨組み、最小限の `app.v1.js`、訳の入った辞書） |
| `check/` | 確かめるためのスクリプト（下の「確かめ方」） |
| `ogp/` | SNS のカード画像（`ogp.png`）と、置き場サイトのツールの絵（`thumbs/*.webp`）を作るスクリプト |

共通の部品の `i18n.v1.js`（言語）と `theme.v1.js`（明るさ）は、このリポジトリの直下が原本です。各ツールには同じファイルを置きます。

## 新しいツールを作るとき

```powershell
node _dev\design\new-tool.js ..\my-new-tool "ツールの名前" "English Name" "한국어 이름"
```

`..\my-new-tool` に、次のものができます（フォルダは先に作らないでください）。

- `index.html`: ページの骨組み。`<style>` には `tool.css` が入っています
- `app.v1.js`: タブ、スライダーの値の表示、プレビューの背景、状態の行
- `lang.en.v1.js` / `lang.ko.v1.js`: 骨組みの文言の訳
- `i18n.v1.js` / `theme.v1.js`: 共通の部品
- `favicon.svg`: 置き場サイトのものを仮に置いてあります。ツールのものに描き替えます

そのあとの進め方:

1. 骨組みのクラス名を保ったまま、設定とプレビューを作ります（下の「ページの骨組み」）。
2. そのツールだけの部品のスタイルは、`<style>` の共通部分の**後ろ**に、`/* ---- This tool only (ツール名): … */` というコメントから始めて書きます。共通部分は書き換えません。
3. 書いたツールだけの部分を、`_dev/design/tool-only/<リポジトリ名>.css` にも保存します。こうしておくと、あとで `tool.css` を直したときに `apply.js` で入れ直せます。
4. 文言は日本語で書き、訳を辞書に足します。漏れは `node _dev\i18n-check.js ..\my-new-tool` で確かめます。
5. 「確かめ方」の `page.js` と `theme-switch.js` を通します。
6. `LICENSE`（MIT）と `README.md` を足し、置き場サイトの `index.html` にカードを足します（置き場サイトの README の「ツールを増やすとき」）。

### ページの骨組み

```
header
  .topline            ‹ shiki365 のツール置き場 ／ .prefs（.lang-switch と .theme-switch）
  h1                  ツールの名前
  p                   説明
main                  左右 2 列。860px 以下で縦に並ぶ
  .panel              左: 設定
    nav.tabbar        タブ（button[role=tab][data-tab]）。タブが要らなければ省く
    section[data-tab-panel]
      fieldset > legend      設定のまとまりと、その見出し
        .row                 ラベルと中身（label + 部品）。.row.wide は 1 列、.row.sub は一段下げ
        .desc                説明文。警告は .desc.warn-text
  .stage-wrap         右: プレビューと、その下
    .bar              横に並べる行（.spacer で左右に分ける）。.seg は選び分けるボタンの組
    .stage            プレビュー。背景は .bg-scene / .bg-checker / .bg-dark / .bg-light
    .tester           プレビューで試すための箱
    .bar              保存・コピーの行（.tester か .source-url のすぐ後ろに置くと、目立つ箱になる）
    .status           状態の 1 行。エラーは .status.error
    .note             使い方（h2 と ol / ul）
footer                非公式の一文、共通のリンク、版と最終更新
```

行の中身の並べ方: `.with-value`（スライダーと値）、`.color-alpha`（色・スライダー・値）、`.pair`（2 つ）、`.trio`（3 つ）、`.checks`（チェックボックスを縦に）、`.btns`（ボタンを並べる）。ボタンは `button`、`button.primary`（主ボタン。1 画面に 1 つ）、`button.small`、`button.danger`。

## 今あるツールに入れるとき

リポジトリを同じフォルダに並べておきます（`shiki365.github.io` と各ツールが隣どうし）。置き場サイトのリポジトリで実行します。

```powershell
node _dev\design\apply.js ..\chat-window-maker
node _dev\design\apply.js ..\scene-transition-maker\docs
node _dev\design\apply.js ..\cover-print-maker --version v1.1
```

- `<style>` を、`tool.css` ＋ `tool-only/<リポジトリ名>.css`（あれば）に入れ替えます。何度実行しても同じ結果になります。
- 切り替えボタンがまだ無いツールには、`theme.v1.js`、ボタンの置き場所、辞書の 5 語も入れます。
- 置き場サイト自身（このリポジトリの直下の `index.html`）は、`node _dev\design\apply.js . --hub` で `hub.css` を入れます。
- `--version` を付けると、フッターの版と最終更新を書き換えます（日付は `--date 2026-11-13` で指定、省くと今日）。
- HTML のほかの部分と、ツールの JS には触れません。

入れたあとは、必ず「確かめ方」を通します。README の「ファイル」の表やダーク・ライトの説明も、まだ無ければ足します（A+ 案を入れた 6 ツールには入っています）。

### ツールごとのメモ

| ツール | ツールだけの部分 | 「元と同じ」の確かめ | 気をつけること |
| --- | --- | --- | --- |
| チャットウィンドウメーカー | なし | `same-css.js`（66 の状態） | 共通のスタイルの元になったツール |
| メッセージボックスメーカー | なし | `same-css.js`、`SEND_WAIT=8000` | 発言は、前の発言を打ち終えて 1.2 秒後に出る |
| ステータスバーメーカー | 飾り・バーの一覧・キャラ・数値の確かめ | `same-css.js`、`SEND="[data-test=half]" SEND_WAIT=1500`（104 の状態） | |
| 前景フレームメーカー | キャンバスのプレビュー、色の選び方、素材と差分の一覧 | `same-png.js`（20 ファイル） | プレビューは枠の画像そのもの。大きさは `app.v3.js` が決める |
| 場面転換素材メーカー | タブのない設定、16:9 のプレビューと背景 | `same-animation.js`（55 ファイル、約 2 分） | 対象は `docs/`。背景のクラスは `scene` / `light` / `checker` / `custom` |
| シナリオテキストメーカー | 右側のカード、話し手、画像の置き場、一覧と手直し | `same-roomdata.js`、`page-scenario-text.js` | JSZip を cdnjs から読む。届かない環境では `JSZIP` を指定 |
| 表紙入稿メーカー | 絵の枠、キャンバス、確認の一覧 | `same-cover.js`（53 の状態と、書き出すファイル 6 つ。CMYK の ICC プロファイルが要る） | `../doujin-printer-finder/` の JS を読むので、2 つを隣に置いて開く。確認の一覧の背の色の色番号とプレビューのキャンバスは、箱の幅で値が変わるので比べから外してある |
| 同人誌の印刷所さがし | ページ全体のタブ、結果のカード、一覧、印刷所のページ | `same-finder.js`（71 の状態。22 社すべての個別ページも） | `main` が 2 つある（一覧と、印刷所のページ）。文字は `textContent` で比べる（`innerText` は見た目で変わる） |

### 残っていること

- **目で確かめること（機械では測れないもの）**: Windows の Yu Gothic UI での文字の詰まり具合、Firefox と Safari でのプルダウンの矢印と色の欄、スマホの実機でのスライダー。ツールごとの部品は、緑青を入れた状態でダークとライトを見て大きな崩れがないことまで確かめました。細かい整えは、実機で見てから。
- **ヘッドレスでは試していないこと**: 画像・フォントのファイル選択、ドラッグ＆ドロップ、PC のフォント一覧、プロジェクトファイルの読み込み。どれも JS は変えていません。
- 置き場サイトの `_dev/ogp.html` は、前の配色のカード画像の原本です。今は `ogp/make-ogp.js` が代わりなので、使っていません。
- 選ばなかった案のフォルダ（`_dev/design-proposals/` の `a/` `a-frame-2px/` `b/` `c/` など）を残すか消すか。公開はされないので、残しても害はありません。

## 確かめ方

Node と Playwright が要ります（`npm i playwright`）。リポジトリを並べたフォルダで、静的サーバーを立てます。

```powershell
python -m http.server 8000
```

これで、`http://localhost:8000/chat-window-maker/` のように各ツールが開けます。別のターミナルで、置き場サイトのリポジトリから実行します。

```powershell
# エラー・横のはみ出し・コントラスト（4 通りの明るさ × 幅 1280 / 375 × 3 言語。タブはすべて開く）
node _dev\design\check\page.js http://localhost:8000/chat-window-maker/

# 切り替えボタン（13 項目）
node _dev\design\check\theme-switch.js http://localhost:8000/chat-window-maker/

# 辞書の漏れ
node _dev\i18n-check.js ..\chat-window-maker
```

見た目だけを変えたときは、**作るものが元と 1 バイトも変わらない**ことも確かめます。元の版を別のフォルダに取り出して（例: `git archive origin/main | tar -x -C ..\orig\chat-window-maker`）、元と新しいほうの URL を渡します。

```powershell
$env:ORIG = "http://localhost:8000/orig/chat-window-maker/"
$env:NEW  = "http://localhost:8000/chat-window-maker/"
node _dev\design\check\same-css.js          # CSS を作るツール
node _dev\design\check\same-png.js          # 前景フレームメーカー
node _dev\design\check\same-animation.js    # 場面転換素材メーカー（URL は docs/）
node _dev\design\check\same-roomdata.js     # シナリオテキストメーカー
node _dev\design\check\same-finder.js       # 同人誌の印刷所さがし（ファイルは作らないので、出る結果を比べる）
$env:ICC = "C:\path\to\JapanColor2001Coated.icc"   # 表紙入稿メーカーは CMYK のプロファイルが要る
node _dev\design\check\same-cover.js        # 表紙入稿メーカー（絵はスクリプトが python3 と Pillow で作る）
```

`$env:SCHEME = "light"` を付けると、OS がライトの状態で同じことを確かめます。各スクリプトの使い方は、ファイルの先頭に書いてあります。

目で確かめること（機械では測れないもの）:

- Windows の Yu Gothic UI での文字の詰まり具合
- Firefox と Safari でのプルダウンの矢印と色の欄
- ツールごとの部品を、ダークとライトの両方で 1 画面ずつ

## カード画像を作り直すとき

SNS に貼ったときに出る画像（各ツールの `ogp.png`、1200×630）と、置き場サイトに並ぶツールの絵（`thumbs/<リポジトリ名>.webp`、640×336）は、同じ 1 枚から作ります。ツールの実物をヘッドレスのブラウザで開き、プリセットを選んだ見本を撮って、緑青のカードに並べます。

```bash
# 全部（リポジトリを同じフォルダに横に並べておく）
node _dev/design/ogp/make-ogp.js

# 一部だけ
node _dev/design/ogp/make-ogp.js status-bar-maker hub
```

- Playwright と Python の Pillow、太字の日本語フォント（Noto Sans CJK）が要ります。ページ自体には関係ありません。
- 載せるプリセットや文言は、`make-ogp.js` の中のツールごとの段落で決めています。新しいツールは、そこに 1 段落足します。
- **同人誌の印刷所さがしのカードには、実在の印刷所の名前と値段を出しません**（「印刷所 A」「〇〇,〇〇〇円」の絵にしてあります）。
- 画像を差し替えても、SNS 側が古い画像を覚えていることがあります。

## `tool.css` を直すとき

1. `tool.css` を直します（置き場サイトも変えるなら `hub.css` も）。色を変えたら、上の「色」の表も直します。
2. 各ツールに `apply.js` で入れ直し、「確かめ方」を通します。
3. ツールごとに、版を上げて PR を出します。ツールの間を移ったときに見た目が揃うよう、なるべく同じ日に公開します。
