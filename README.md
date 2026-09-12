# MathLoop

> 解く。

学部数学の演習問題を解き、結果と学習統計を記録する個人向けWebアプリです。

Codexでエンター押していたらできました。ありがとう。2

## コンテスト構成

レベル1〜3のシリーズ構成です。現在は`レベル 1 #001`から`レベル 1 #010`までの10セット、全50問を収録しています。一覧では1セットを1行、A〜Eの問題を列として表示します。

## 主な機能

- 問題タイトル・分野・知識タグによる検索と絞り込み
- 日本語・TeXによる回答とライブプレビュー
- 解答写真の添付
- AC・要確認・WAの採点結果表示
- 解説、定義、定理、周辺知識の確認
- Supabaseを使ったスマホ・PC間の学習記録同期
- 分野別・タグ別・難易度別の統計

## 25マス計算

メニューの「25マス計算」から、縦横それぞれ5つの値を組み合わせる計算表に取り組めます。整数の加算・乗算、分数の加算、複素数の乗算を各10セット収録しています。同じセット番号では同じ問題を出題し、25問の一括採点、解答表示、再挑戦、最初の入力から採点までの時間計測に対応しています。

入力とセットごとの直近の結果はブラウザのローカルストレージに保存します。既存の学習統計、端末間同期、保存データの書き出しには含まれません。分数は同値な分数・有限小数を受け付けますが、循環小数の近似値は正解にしません。複素数は `a+bi` 形式で入力します。

## ローカル起動

Node.js 22.13以降を使用します。

```bash
npm install
npm run dev
```

## ビルド

```bash
npm run build
npm run build:pages
```

GitHub Pages用の成果物は `dist/client/math-loop` に作成されます。

## GitHub Pages への公開

このサイトへの変更は、ローカルで完結させず GitHub Pages にも反映します。
`main` ブランチへ push すると、[GitHub Actions](.github/workflows/pages.yml) が `npm run build:pages` を実行し、生成物を GitHub Pages へ自動デプロイします。

公開する変更では、`main` へマージ・push した後に Actions の **Deploy MathLoop to GitHub Pages** が成功していることを確認してください。作業ブランチへの push だけでは公開されません。

## Supabase

`.env.example` を `.env.local` にコピーし、SupabaseのURLとPublishable Keyを設定します。

```bash
npx supabase db push
npx supabase secrets set SAKURA_AI_API_KEY=your_key
npx supabase functions deploy grade-answer
```

`grade-answer` はログインユーザーだけが利用でき、AI採点は1時間10回・1日40回までです。
