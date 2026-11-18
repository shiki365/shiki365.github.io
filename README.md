# shiki365 のツール置き場

作ったツールをまとめて紹介するサイト。

**公開サイト: https://shiki365.github.io/**

ブラウザで使うツールは、それぞれ別のリポジトリで GitHub Pages に公開していて、このサイトはその入り口。ツール側の画面にも、ここへ戻るリンクと問い合わせ先へのリンクを入れてある。BOOTH で配布しているソフト（在室灯）も載せている。

## ファイル

| ファイル | 中身 |
| --- | --- |
| `index.html` | トップ＝TRPG・マダミスのページ（CSS もこの中。JavaScript は言語と明るさの切り替えだけ） |
| `doujin/` | 同人誌づくりのページ（`index.html`、その辞書 `lang.en.v1.js` / `lang.ko.v1.js`、SNS のカード `ogp.png`）。`i18n.v1.js` と `theme.v1.js`、カードの絵は `../` から読む |
| `i18n.v1.js` | 日本語・英語・韓国語の切り替え。**各ツールにも同じファイルを置く**（元はここ） |
| `theme.v1.js` | ダーク・ライトの切り替え。**各ツールにも同じファイルを置く**（元はここ） |
| `lang.en.v1.js` / `lang.ko.v1.js` | トップの英語・韓国語の辞書。キーは日本語の文そのもの |
| `thumbs/` | カードのサムネイル（640×336）。各ツールの `ogp.png` や BOOTH の商品画像を縮めたもの |
| `ogp.png` | トップの URL を SNS に貼ったときのカード画像（同人誌づくりのページは `doujin/ogp.png`） |
| `favicon.svg` | タブのアイコン |
| `_dev/` | サムネイルと OGP 画像を作るためのファイルと、辞書の漏れを調べる `i18n-check.js`、デザインの原本と道具（`design/`）、決めるまでの案の記録（`design-proposals/`）。`_` で始まるので GitHub Pages（Jekyll）では公開されない |

見た目はツールと同じ（2026-11 に一新。「緑青」: 暗い地に緑青の差し色、ライトは紙の地。まとまりごとに枠を付け、設定の見出しは罫線の上に置く）。原本は `_dev/design/hub.css` で、`node _dev\design\apply.js . --hub` で 2 つのページ（直下と `doujin/`）の `<style>` に同じものが入る。各ツールの原本は同じフォルダの `tool.css`。新しいツールのひな形、各ツールへの入れ方、確かめ方、色の表、守ることも、`_dev/design/README.md` にある。色はすべて `:root` の変数（`--bg` `--panel` `--accent` `--button` など）で持ち、ライトでは変数の値だけを差し替える。主ボタンは、ダークは緑青の地に濃い文字、ライトは深い緑青の地に白い文字。決めるまでに比べた案は `_dev/design-proposals/README.md` にある。

## ページの中身

ジャンルごとにページを分けている（2026-11-18 から。前は 1 ページを「ブラウザで使う／ダウンロードして使う」で区切っていた）。タイトルの下のタブ（`<nav class="genres">`）は、ただのリンク。ジャンルを足すときは、ページを作って、すべてのページのタブに足す。

**トップ（`/`）＝ TRPG・マダミス**

| 見出し | id | 中身 |
| --- | --- | --- |
| ルームを作る | `#room` | ココフォリアのルームデータ（ZIP）を作るツール |
| 盤面の素材を作る | `#assets` | 前景の枠、場面転換の動く画像 |
| 配信画面に映す | `#stream` | OBS に映すツール。BOOTH で配布している在室灯もここ（「ダウンロード」の札） |
| ブラウザのツールの使い方 | — | 3 手順 |
| よくある質問 | `#faq` | |
| 不具合の報告・感想 | `#contact` | TRPG のツールのフッターからここへリンクしている |
| 開発を応援する | `#support` | |

**`/doujin/` ＝ 同人誌づくり**

| 見出し | id | 中身 |
| --- | --- | --- |
| 印刷所選びと入稿 | `#print` | 同人誌の印刷所さがし、表紙入稿メーカー |
| 使い方 | `#steps` | 3 手順（印刷所さがし → 表紙入稿メーカー） |
| よくある質問 | `#faq` | 同人誌のツール向け |
| 不具合の報告・感想 | `#contact` | 同人誌のツールのフッターからここへリンクしている（フォームはトップと同じ） |
| 開発を応援する | `#support` | |

問い合わせ先:

- ブラウザのツールの不具合 … Google フォーム「shiki365 のツール 不具合報告フォーム」（鯖の禊の Google アカウントで作成。匿名・ログイン不要の設定）
- 在室灯の不具合・動作報告 … 在室灯のベータ版フォーム（在室灯の README と同じもの。これも鯖の禊のアカウント）
- 感想・要望 … マシュマロ（https://marshmallow-qa.com/jisg2c3imbza76d）

## 言語（日本語・英語・韓国語）

ページは日本語で書き、`i18n.v1.js` が表示のときに辞書で置き換える。使い方は `i18n.v1.js` の冒頭に書いてある。

- 言語は `?lang=xx` → 前に選んだ言語（`localStorage` の `shiki365.lang`。`shiki365.github.io` のページすべてで共有）→ ブラウザの言語の順で決まる。日本語・韓国語のどちらでもないブラウザは英語
- `<html data-langs="ja en ko">` に、そのページが対応している言語を書く。対応していない言語を選んでいたら日本語で出る
- 文言を足したり変えたりしたら、辞書にも足して漏れを確かめる

  ```powershell
  node _dev\i18n-check.js .                       # トップ
  node _dev\i18n-check.js doujin                  # 同人誌づくりのページ
  node _dev\i18n-check.js ..\kokofolia-apng\docs  # ツール
  ```

- 同人誌づくりのページの辞書は `doujin/` にある。トップと同じ文（カードの見出し、問い合わせ、フッターなど）は写してあるので、片方を直したら両方を直す
- 「訳の誤りを知らせる」が UNUSED と出るのは正常（`i18n.v1.js` が実行時に使う語なので、HTML からは見えない）

- 訳していないもの（いまは在室灯だけ）のカードには、`<span class="label" data-lang-only="en ko">日本語のみ</span>` を付けている

## 明るさ（ダーク・ライト）

ページ上部の「自動 / ダーク / ライト」で選ぶ。使い方は `theme.v1.js` の冒頭に書いてある。

- 「自動」はパソコンやスマホの設定（`prefers-color-scheme`）に合わせる。ダークかライトを選ぶと `<html data-theme="…">` が付き、`localStorage` の `shiki365.theme` に覚える（言語と同じく `shiki365.github.io` のページすべてで共有）
- CSS では、ダークを `:root` に、ライトを `@media (prefers-color-scheme: light) { :root:not([data-theme=dark]) { … } }` と `:root[data-theme=light] { … }` の両方に書く（同じ値を 2 回）
- 色を足すときは、直書きせず変数にして、ライトの値も同時に決める。直書きの色が残ると、片方の明るさだけで読めなくなる

## ツールを増やすとき

1. ジャンルのページ（TRPG・マダミスは直下の `index.html`、同人誌づくりは `doujin/index.html`）の、該当する区分の `<ul class="tools">` に `<li class="tool">` を 1 つ足す（上ほど新しい）。「こんなときに」「作れるもの（種類）」「使う場所」を書く。`doujin/` では絵を `../thumbs/…` で読む
2. `_dev/make-thumbs.py` の `SOURCES` に画像を足して実行する。比率が 1200:630 と違う画像は中央で切り抜かれる

   ```powershell
   ..\kokofolia-apng\.venv\Scripts\python.exe _dev\make-thumbs.py
   ```

3. ブラウザのツールなら、ツール側の `index.html` にほかのツールと同じリンクを入れる。行き先はそのツールのジャンルのページ
   - ヘッダーの `<a class="home-link" href="https://shiki365.github.io/">‹ shiki365 のツール置き場</a>`（同人誌づくりのツールは `https://shiki365.github.io/doujin/`）
   - フッターの「ほかのツールも見る」と「不具合の報告・感想」（`https://shiki365.github.io/#contact`。同人誌づくりのツールは `https://shiki365.github.io/doujin/` と `https://shiki365.github.io/doujin/#contact`）
4. 問い合わせの Google フォームの「どのツールについてですか？」に選択肢を足す
5. SNS のカード画像は `_dev/design/ogp/make-ogp.js` で作る（`hub` がトップの `ogp.png`、`hub-doujin` が `doujin/ogp.png`。Playwright が要る。使い方は `_dev/design/README.md` の「カード画像を作り直すとき」）。`_dev/ogp.html` は前の配色のときの原本で、今は使っていない

## 公開

リポジトリ名を `shiki365.github.io`（公開リポジトリ）にすると、`https://shiki365.github.io/` として公開される。
このユーザーサイトは、push しただけで Settings → Pages が「ブランチ `main`・フォルダ `/ (root)`」になった（手で設定する必要はなかった）。

HTML は数分ほどキャッシュされることがあるので、更新直後の確認は `Ctrl+F5` で。
