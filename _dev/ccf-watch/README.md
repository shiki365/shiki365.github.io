# ココフォリアの見張り（ccf-watch）

ココフォリアの本体 JS（`https://ccfolia.com/` が読み込む `static/js/main.*.js`）を毎朝 1 回取ってきて、ツールが頼っている部分がまだあるかを調べる。見つからなくなったときと、本体 JS が変わったときに、このリポジトリに Issue を立てる。

CSS を書き出すツール（ステータスバーメーカー・チャットウィンドウメーカー・メッセージボックスメーカー）は、ココフォリアの画面のクラス名や属性を狙っている。シナリオテキストメーカーは、ルームデータ ZIP の形に合わせている。ココフォリアが更新されると、どれも何も言わずに効かなくなる。利用者からの報告より先に気づくためのもの。

## ファイル

| ファイル | 中身 |
| --- | --- |
| `items.json` | 見張る項目の一覧。項目ごとに、頼っているツールとファイル、狙っているセレクタ、本体 JS の中で探す文字列か正規表現 |
| `watch.js` | 調べて Issue を立てるスクリプト（Node だけで動く。依存なし） |
| `watch.test.js` | 偽の本体 JS で判定と Issue の文面を確かめるテスト |
| `fixtures/` | 偽のトップページと本体 JS。本物ではなく、本物の書き方（terser で縮めた React + MUI）をまねて書いたもの |
| `/.github/workflows/ccf-watch.yml` | 毎朝の実行 |

## 動き

- 毎朝 7:17（日本時間）に動く。Actions の画面から手でも動かせる（Run workflow）
- 取るのはトップの HTML と、そこに書いてある `main.*.js` の 2 つだけ（取り方は `_dev/ccf-terms.js` と同じ）。ログインや API は使わない
- 前回の記録（`main.*.js` の名前・SHA-256・版、項目ごとに見つかった数）は **Actions のキャッシュ**に置く。`main` にコミットしないのは、コミットすると公開サイトが作り直されるから
  - キャッシュは 7 日使われないと消える。消えても、次の実行が「前回の記録なし」として記録し直すだけ
- Issue は 3 種類。**同じ種類の Issue が開いていれば、新しく立てずにコメントを足す**（本文の先頭の `<!-- ccf-watch:missing -->` などで見分ける）。前回と同じ結果の日は何も書かない

| 種類 | 立つとき | タイトル |
| --- | --- | --- |
| missing | 項目が見つからない（新しく見つからなくなった、足した項目が見つからない、本体 JS が変わってもまだ見つからない） | `[ccf-watch] ツールが頼っているココフォリアの部分が見つからない` |
| changed | 本体 JS が変わり、項目は全部見つかった | `[ccf-watch] ココフォリアの本体 JS が変わった` |
| error | 2 回続けて本体 JS を取ってこられない（そのあとは 7 回ごと） | `[ccf-watch] ココフォリアの本体 JS を取ってこられない` |

- 見つからなかった項目が全部戻ると、開いている missing の Issue にそう書き込む。取れるようになると、開いている error の Issue にそう書き込む。どれも閉じるのは手で
- 実行ごとの結果（全項目の ✅ / ❌ と、見つかった数）は、Actions の実行ページの Summary に出る
- Issue とコメントの通知は、ふつうの GitHub の通知で届く（自分のリポジトリは最初から Watch している）

## 見ている項目

全部は `items.json`。ツールごとのまとめ:

| ツール | 本体 JS で探しているもの |
| --- | --- |
| ステータスバーメーカー | `#root`（トップの HTML）、`/rooms/:id/characters/:id` の URL、`MuiBadge`（`badge` `invisible`）、`MuiAvatar`（`img`）、`MuiSnackbar`、`variant:"bar"`、80% 以下で付く `"secondary"` |
| チャットウィンドウメーカー | `#root`、`/rooms/:id/chat` の URL、`MuiDrawer`（`paper`）・`MuiListItem`・`MuiListItemAvatar`・`MuiListItemText`（`primary` `secondary`）・`MuiTypography`（`body2` `caption`）・`MuiToolbar`・`MuiIconButton`・`MuiPaper`・`MuiTabs`（`scroller` `indicator`）・`MuiTab`（`selected`）・`MuiTouchRipple`・`MuiBadge`・`MuiBox-root`・`MuiAvatarGroup`・`MuiAvatar`・`MuiSnackbar`、`Mui-selected` の元の対応表、`role:"log"`、`role:"tablist"`、`"data-index"`、`overscan:50`、テーマの色 `#2196f3` / `#dc004e` |
| メッセージボックスメーカー | `#root`、`role:"status"` と `"aria-live":"polite"`、`MuiPaper`・`MuiToolbar`・`MuiTypography`（`subtitle2` `body2`）・`MuiIconButton`、テーマの色 `#2196f3` / `#dc004e` |
| シナリオテキストメーカー | `"__data.json"`、`version:"1.1.0"`（`meta.version`）、`".token"`、`"SHA-256"`、`"image/jpeg":["jpeg"`（拡張子は mime の最初のもの）、画像として取り込む 6 つの欄（`backgroundUrl` `foregroundUrl` `coverImageUrl` `imageUrl` `iconUrl` `thumbnail`）が近くに並んでいること |

`MuiBadge` などは、`.MuiBadge-root` という文字列では本体 JS に入っていない。MUI は `"MuiBadge",["root","badge",…,"invisible",…]` という並びからクラス名を作るので、その並びに使っている名前があるかを見ている。

### 文字列では見張れない前提

次のものは本体 JS の文字列からは分からない。`items.json` の `manual` に書いてあり、changed の Issue に「確かめること」として出る。

- 画面の並び（`nth-child`、`div:last-child > div > div[data-index]`、`> img` など）
- ステータスバーの伸び縮みする部分の `style="width: 83.3333%;"` の書式（`[style^="width: 8"]` で判定している）
- ダイスの成否のクラス `css-1l6qhgm` / `css-1j13mke` / `css-ucj12`。emotion がスタイルの中身から作るハッシュなので、本体 JS には入っていない。元になるテーマの色は見張っているが、MUI の版や文字の設定が変わっても名前が変わる
- メッセージボックスを閉じたときに付く `style="visibility: hidden"`
- ルームデータ ZIP の読み込みの動き

## Issue が立ったら

### missing（見つからない）

1. 項目ごとの「前回はあった」「前回から見つからない」「記録なし」を見る
2. **前回はあった** … ココフォリアの更新で変わった見込みが高い。Issue に出ているツールを OBS で開いて（シナリオテキストメーカーは ZIP を読み込んで）、崩れていないか見る
   - 崩れていたら、ツールを直す。直し終わったら、新しい形に合わせて `items.json` も直す
   - 崩れていなければ、探す文字列のほうが古い。下の「項目を直す・足す」で `items.json` を直す
3. **記録なし・前回から見つからない** … 初回か、足したばかりの項目。探す文字列が最初から合っていないことが多い。`items.json` を直す

### changed（本体 JS が変わった）

文字列で見張っている項目は全部見つかった、という知らせ。急ぎではない。時間のあるときに Issue のチェックリストのとおりツールを確かめて、問題がなければ閉じる。開いたままにしておくと、次に本体 JS が変わったときにコメントが足される。

### error（取ってこられない）

1. ブラウザで https://ccfolia.com/ が開けるか見る。メンテナンス中なら、明ければ次の実行で直る（直ったら Issue に書き込まれる）
2. 開けるのに続くときは、Issue のエラーを見る
   - 「main.*.js が見つからない」… トップの HTML の作りが変わった。ブラウザでページのソースを見て、`items.json` の `bundle`（正規表現）を直す
   - `HTTP 403` など … GitHub Actions からのアクセスが断られている。この見張りは使えない状態なので、止めることも考える

## 項目を直す・足す

### 1. 本物の本体 JS を落とす

本体 JS はココフォリアのものなので、**リポジトリの外に保存して、コミットしない**。

```powershell
curl.exe -s https://ccfolia.com/ | Select-String -Pattern 'static/js/main\.[a-z0-9]*\.js' -AllMatches | % { $_.Matches.Value }
curl.exe -s https://ccfolia.com/static/js/main.<ハッシュ>.js -o ..\ccf-main.js
```

### 2. 手元で調べる

```powershell
node _dev\ccf-watch\watch.js --js ..\ccf-main.js --dry-run
```

全項目の ✅ / ❌ と見つかった数が出る（`--dry-run` は Issue を立てず、記録も残さない）。`--js` だけだとトップの HTML を見ないので、`#root` の項目は「–」になる。`--js` を付けなければ、ココフォリアから取ってきて調べる。

探す文字列を決めるには、`Select-String` や `_dev/ccf-terms.js` で本体 JS の中を探して、前後の書き方を見る。

```powershell
Select-String -Path ..\ccf-main.js -Pattern '"MuiBadge",\[' | % { $_.Line.Substring([Math]::Max(0, $_.Matches[0].Index - 40), 200) }
```

### 3. `items.json` に書く

```json
{
  "id": "chat.roleLog",
  "what": "メッセージ一覧の role（[role=\"log\"]）",
  "selectors": [".MuiDrawer-paper > [role=\"log\"]"],
  "uses": { "chat-window-maker": ["css.v1.js"] },
  "text": "role:\"log\""
}
```

| キー | 中身 |
| --- | --- |
| `id` | 重ならない名前。Issue と記録の見出しになる。変えると「記録なし」の項目として扱われる |
| `what` | 何のための項目か（Issue に出る） |
| `selectors` | ツールが書き出すセレクタ（Issue に出る。無ければ `[]`） |
| `uses` | `tools` のキー → 頼っているファイル。Issue からそのファイルへリンクする |
| `text` / `regex` / `near` | 探し方。どれか 1 つ |
| `in` | `"html"` にすると、本体 JS ではなくトップの HTML で探す |

探し方:

- `text` … そのままの文字列。日本語などが `\uXXXX` で書かれていても見つける
- `regex`（と `flags`）… JavaScript の正規表現。JSON の中なので、`\` は `\\`、`"` は `\"` と書く（`"MuiBadge",\[` → `"\"MuiBadge\",\\["`）
- `near` と `within` … 最初の文字列の前後 `within` 文字以内に、ほかの文字列が全部あること

本体 JS の書き方の癖（terser で縮めてある）:

- 文字列はダブルクォート。オブジェクトのキーはクォートなし（`role:"log"`）、ハイフンが入るキーはクォート付き（`"aria-live":"polite"`）
- `0.8` は `.8`、`true` は `!0`、`undefined` は `void 0`
- 変数名は 1〜2 文字に縮められ、更新のたびに変わる。探す文字列に変数名を入れない

ツールを足すときは、`tools` にも書く（`name`、`repo`、OBS などで何を確かめるかの `check`）。文字列で見張れない前提は `manual` に書く（`uses` まで。探し方は書かない）。

### 4. テストを通す

`fixtures/main.fake.js` に、足した項目に当たる 1 行を本物と同じ形で足して、テストを動かす。テストは「`items.json` の全項目が偽の本体 JS で見つかる」ことも確かめている。

```powershell
node --test _dev\ccf-watch\watch.test.js
```

`main` にコミットすれば、次の実行から使われる。見つからなかった項目が直っていれば、開いている missing の Issue に「全部見つかった」と書き込まれる。

## 初めて動かすとき

このスクリプトは、作った環境からココフォリアに届かなかったので、偽の本体 JS でしか試していない。探す文字列は本物の書き方を予想して書いたものなので、外れている項目があるかもしれない。

1. Actions タブ → ccf-watch → Run workflow。最初は `dry_run` に印を付けると、Issue を立てずに結果だけ見られる
2. 実行ページの Summary を見る。全部 ✅ ならそのままでよい
3. ❌ の項目は、探す文字列が本物と合っていない。上の「項目を直す・足す」で直す（直さずに印を外して動かすと、「記録なし」として missing の Issue が立つ）
4. 「版は読み取れず」と出たら、`items.json` の `version`（正規表現。1 つ目の `()` が版になる）を直す。読めなくても、見張りは `main.*.js` の名前と中身で比べるので困らない

## 止まるとき・止めるとき

- **公開リポジトリの定期実行は、リポジトリに 60 日間動きが無いと GitHub が自動で止める。** 止まると Actions タブの ccf-watch に知らせが出るので、「Enable workflow」を押せば再開する。コミットすると 60 日の数え直しになる（見張りが立てる Issue は動きとして当てにしない）
- しばらく止めたいときは、Actions タブ → ccf-watch → 右上の「…」→ Disable workflow
- `main` へのコミットはしないので、見張りが動いても公開サイトは作り直されない
