# MathLoop

> 解く。

学部数学の演習問題を解き、結果と学習統計を記録する個人向けWebアプリです。

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
