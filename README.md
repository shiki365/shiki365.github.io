# shiki365 のツール置き場

作ったツールをまとめて紹介するサイト。

**公開サイト: https://shiki365.github.io/**

ブラウザで使うツールは、それぞれ別のリポジトリで GitHub Pages に公開していて、このサイトはその入り口。ツール側の画面にも、ここへ戻るリンクと問い合わせ先へのリンクを入れてある。BOOTH で配布しているソフト（在室灯）も載せている。

## ファイル

| ファイル | 中身 |
| --- | --- |
| `index.html` | 一覧ページ（CSS もこの中。JavaScript は無し） |
| `thumbs/` | カードのサムネイル（640×336）。各ツールの `ogp.png` や BOOTH の商品画像を縮めたもの |
| `ogp.png` | このサイトの URL を SNS に貼ったときのカード画像 |
| `favicon.svg` | タブのアイコン |
| `_dev/` | サムネイルと OGP 画像を作るためのファイル。`_` で始まるので GitHub Pages（Jekyll）では公開されない |

配色はツールと同じ（`--bg` `--panel` `--accent` など）。ボタンだけは白い文字が読みやすいよう、`--accent` より少し暗い `--button` にしている。

## ページの中身

| 見出し | id | 中身 |
| --- | --- | --- |
| ブラウザで使うツール | `#browser-tools` | GitHub Pages で公開しているツール |
| ダウンロードして使うツール | `#download-tools` | BOOTH で配布しているソフト |
| ブラウザのツールの使い方 | — | 3 手順 |
| よくある質問 | `#faq` | |
| 不具合の報告・感想 | `#contact` | ツールのフッターからここへリンクしている |

問い合わせ先:

- ブラウザのツールの不具合 … Google フォーム「shiki365 のツール 不具合報告フォーム」（鯖の禊の Google アカウントで作成。匿名・ログイン不要の設定）
- 在室灯の不具合・動作報告 … 在室灯のベータ版フォーム（在室灯の README と同じもの。これも鯖の禊のアカウント）
- 感想・要望 … マシュマロ（https://marshmallow-qa.com/jisg2c3imbza76d）

## ツールを増やすとき

1. `index.html` の該当する区分の `<ul class="tools">` に `<li class="tool">` を 1 つ足す（上ほど新しい）。「こんなときに」「作れるもの（種類）」「使う場所」を書く
2. `_dev/make-thumbs.py` の `SOURCES` に画像を足して実行する。比率が 1200:630 と違う画像は中央で切り抜かれる

   ```powershell
   ..\kokofolia-apng\.venv\Scripts\python.exe _dev\make-thumbs.py
   ```

3. ブラウザのツールなら、ツール側の `index.html` にほかのツールと同じリンクを入れる
   - ヘッダーの `<a class="home-link" href="https://shiki365.github.io/">‹ shiki365 のツール置き場</a>`
   - フッターの「ほかのツールも見る」と「不具合の報告・感想」（`https://shiki365.github.io/#contact`）
4. 問い合わせの Google フォームの「どのツールについてですか？」に選択肢を足す
5. OGP 画像にも載せたければ `_dev/ogp.html` を直して撮り直す

   ```powershell
   & "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --hide-scrollbars --window-size=1200,630 --screenshot="$PWD\ogp.png" "file:///$($PWD -replace '\\','/')/_dev/ogp.html"
   ```

## 公開

リポジトリ名を `shiki365.github.io`（公開リポジトリ）にすると、`https://shiki365.github.io/` として公開される。
Settings → Pages で、ブランチ `main`・フォルダ `/ (root)` を指定する。

HTML は数分ほどキャッシュされることがあるので、更新直後の確認は `Ctrl+F5` で。
